import { Octokit } from "octokit";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

export class GitHubService {
  private octokit: Octokit;
  private readonly ignoreList = [
    '.git', '.git857', 'node_modules', 'dist', '.replit', '.upm', 
    'replit.nix', 'package-lock.json', '.env', 'attached_assets',
    '.github/workflows', 'replit.md', 'MAINTENANCE_FIXES.md', 'FIREBASE_SETUP.md',
    'GITHUB_INTEGRATION_GUIDE.md', 'GITHUB_CRON_GUIDE.md', 'FEATURES_GUIDE.md',
    '.DS_Store', 'server/storage.ts', 'logs', 'logs327'
  ];

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async setupRepository(repoName: string, options: {
    appUrl: string,
    cronSecret: string
  }) {
    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      const owner = user.login;
      
      let repo;
      try {
        const { data } = await this.octokit.rest.repos.get({ owner, repo: repoName });
        repo = data;
      } catch (e) {
        const { data } = await this.octokit.rest.repos.createForAuthenticatedUser({
          name: repoName,
          private: true,
          auto_init: true,
          description: "Automated Social Stories Scheduler Platform - Production"
        });
        repo = data;
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased delay for repo availability

      // Setup Workflow first to ensure actions are ready
      await this.setupWorkflow(owner, repoName);

      // Setup Secrets
      try {
        const { data: publicKey } = await this.octokit.rest.actions.getRepoPublicKey({
          owner,
          repo: repoName,
        });

        const setSecret = async (name: string, value: string) => {
          try {
            await this.octokit.rest.actions.createOrUpdateRepoSecret({
              owner,
              repo: repoName,
              secret_name: name,
              encrypted_value: Buffer.from(value).toString('base64'), 
              key_id: publicKey.key_id
            });
            console.log(`✅ Secret ${name} successfully updated`);
          } catch (e: any) {
            console.warn(`⚠️ Warning: GitHub secret ${name} could not be fully automated.`);
          }
        };

        await setSecret('APP_URL', options.appUrl);
        await setSecret('CRON_SECRET_KEY', options.cronSecret);
        
        console.log('✅ GitHub Secrets process completed');
      } catch (err: any) {
        console.warn('⚠️ GitHub Secrets setup encountered an error:', err.message);
      }

      await this.uploadDirectory(owner, repoName, ".");
      await this.setupWorkflow(owner, repoName);

      // Automatically activate scheduler in Firestore
      const { firestoreService } = await import("./firestore");
      const userId = user.id.toString();
      
      // Update system settings to activate scheduler
      await firestoreService.updateUserSettings(userId, {
        autoStoryGenerationEnabled: true,
        lastUpdated: new Date().toISOString()
      } as any);

      return { success: true, url: repo.html_url };
    } catch (error: any) {
      console.error('❌ GitHub Setup Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async uploadDirectory(owner: string, repo: string, rootDir: string) {
    console.log(`🚀 Starting professional upload of directory: ${rootDir} to ${owner}/${repo}`);
    
    const uploadFile = async (filePath: string) => {
      const relativePath = relative(".", filePath);
      
      // Smart ignore logic
      if (this.ignoreList.some(ignore => {
        if (ignore.endsWith('/')) {
          return relativePath.startsWith(ignore);
        }
        return relativePath === ignore || relativePath.startsWith(ignore + '/');
      })) {
        return;
      }

      try {
        if (!existsSync(filePath)) return;
        const stats = statSync(filePath);
        if (stats.size > 50 * 1024 * 1024) { // Skip files > 50MB (GitHub limit is 100MB, but 50MB is safer for API)
          console.warn(`⚠️ Skipping large file: ${relativePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          return;
        }

        const content = readFileSync(filePath);
        let sha;
        try {
          const { data: existingFile } = await this.octokit.rest.repos.getContent({ owner, repo, path: relativePath });
          if (!Array.isArray(existingFile)) sha = existingFile.sha;
        } catch (e) {}

        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner, repo, path: relativePath,
          message: `🔄 professional sync: ${relativePath} [automated]`,
          content: content.toString('base64'),
          sha,
        });
        console.log(`✅ Uploaded: ${relativePath}`);
      } catch (err: any) {
        console.error(`❌ Failed to upload ${relativePath}:`, err.message);
      }
    };

    const walk = async (currentDir: string) => {
      if (!existsSync(currentDir)) return;
      const items = readdirSync(currentDir);
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) await walk(fullPath);
        else if (stats.isFile()) await uploadFile(fullPath);
      }
    };
    await walk(rootDir);
  }

  private async setupWorkflow(owner: string, repo: string) {
    const workflowContent = `
name: Scheduled Story Publisher
on:
  schedule:
    - cron: '*/5 * * * *'  # تشغيل كل 5 دقائق
  workflow_dispatch:      # السماح بالتشغيل اليدوي للاختبار

jobs:
  publish:
    name: Execute Publishing Sequence
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Platform Cron Engine
        run: |
          APP_URL="\${{ secrets.APP_URL }}"
          CRON_SECRET="\${{ secrets.CRON_SECRET_KEY }}"
          
          if [ -z "$APP_URL" ]; then
            echo "❌ APP_URL secret is missing. Please set it in GitHub Repository Secrets."
            exit 1
          fi
          
          echo "🔗 Triggering cron at $APP_URL..."
          curl -X POST "$APP_URL/api/admin/cron/trigger" \\
          -H "Authorization: Bearer $CRON_SECRET" \\
          -H "Content-Type: application/json" \\
          --fail --silent --show-error
`;

    try {
      const path = '.github/workflows/cron.yml';
      let sha;
      try {
        const { data: file } = await this.octokit.rest.repos.getContent({ owner, repo, path });
        if (!Array.isArray(file)) sha = file.sha;
      } catch (e) {}
      
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner, repo, path,
        message: '🚀 ci: setup scheduler',
        content: Buffer.from(workflowContent).toString('base64'),
        sha,
      });
    } catch (err: any) {}
  }
}
