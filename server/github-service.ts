import { Octokit } from "octokit";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

export class GitHubService {
  private octokit: Octokit;
  private readonly ignoreList = [
    '.git', 'node_modules', 'dist', '.replit', '.upm', 
    'replit.nix', 'package-lock.json', '.env', 'attached_assets',
    '.github/workflows', 'replit.md', 'MAINTENANCE_FIXES.md', 'FIREBASE_SETUP.md',
    'GITHUB_INTEGRATION_GUIDE.md', 'GITHUB_CRON_GUIDE.md', 'FEATURES_GUIDE.md',
    '.DS_Store', 'logs'
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
        console.log(`📂 Repository ${repoName} already exists, starting sync...`);
      } catch (e) {
        const { data } = await this.octokit.rest.repos.createForAuthenticatedUser({
          name: repoName,
          private: true,
          auto_init: true,
          description: "Automated Social Stories Scheduler Platform - Production"
        });
        repo = data;
        console.log(`✨ Created new repository: ${repoName}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

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
          } catch (e: any) {}
        };

        if (options.appUrl) await setSecret('APP_URL', options.appUrl);
        if (options.cronSecret) await setSecret('CRON_SECRET_KEY', options.cronSecret);
      } catch (err: any) {}

      // Upload files
      await this.uploadDirectory(owner, repoName, ".");
      
      // Setup Workflow
      await this.setupWorkflow(owner, repoName);

      return { success: true, url: repo.html_url };
    } catch (error: any) {
      console.error('❌ GitHub Sync Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async uploadDirectory(owner: string, repo: string, rootDir: string) {
    const walk = async (currentDir: string) => {
      if (!existsSync(currentDir)) return;
      const items = readdirSync(currentDir);
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          const relPath = relative(".", fullPath);
          if (this.ignoreList.includes(relPath) || relPath.startsWith("node_modules")) continue;
          await walk(fullPath);
        } else if (stats.isFile()) {
          await this.uploadFile(owner, repo, fullPath);
        }
      }
    };
    await walk(rootDir);
  }

  private async uploadFile(owner: string, repo: string, filePath: string) {
    const relativePath = relative(".", filePath);
    
    if (this.ignoreList.some(ignore => {
      if (ignore.endsWith('/')) return relativePath.startsWith(ignore);
      return relativePath === ignore || relativePath.startsWith(ignore + '/');
    })) return;

    try {
      if (!existsSync(filePath)) return;
      const stats = statSync(filePath);
      if (stats.size > 50 * 1024 * 1024) return;

      const content = readFileSync(filePath);
      let sha;
      try {
        const { data: existingFile } = await this.octokit.rest.repos.getContent({ owner, repo, path: relativePath });
        if (!Array.isArray(existingFile)) sha = existingFile.sha;
      } catch (e) {}

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner, repo, path: relativePath,
        message: `🔄 sync: ${relativePath} [automated]`,
        content: content.toString('base64'),
        sha,
      });
      console.log(`✅ Synced: ${relativePath}`);
    } catch (err: any) {
      console.error(`❌ Failed to sync ${relativePath}:`, err.message);
    }
  }

  private async setupWorkflow(owner: string, repo: string) {
    const workflowContent = `
name: Scheduled Story Publisher
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Platform Cron Engine
        run: |
          curl -X POST "\${{ secrets.APP_URL }}/api/admin/cron/trigger" \
          -H "Authorization: Bearer \${{ secrets.CRON_SECRET_KEY }}" \
          -H "Content-Type: application/json" \
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
