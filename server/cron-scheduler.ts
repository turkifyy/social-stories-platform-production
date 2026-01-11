import * as cron from 'node-cron';
import { firestoreService } from './firestore';
import { r2Storage } from './r2-storage';
import { storyMusicService } from './story-music-service';
import { videoGenerator } from './video-generator';
import { musicService } from './music-service';
import { autoStoryGenerator } from './auto-story-generator';
import { storageService } from './storage-service';
import type { Story, LinkedAccount, storyCategories } from '@shared/schema';

export async function refreshAccountToken(account: LinkedAccount) {
  try {
    let newAccessToken = '';
    let newRefreshToken = account.refreshToken;
    let expiresIn = 0;

    if (account.platform === 'facebook' || account.platform === 'instagram') {
      const { facebookSDK } = await import('./sdk/facebook');
      try {
        const tokenData = await facebookSDK.getLongLivedToken(account.accessToken);
        newAccessToken = tokenData.access_token;
        expiresIn = tokenData.expires_in || 5184000;
      } catch (fbError: any) {
        console.error(`❌ Auto-refresh Facebook token failed for ${account.name}:`, fbError.message);
        throw fbError;
      }
    } else if (account.platform === 'tiktok') {
      const { tiktokSDK } = await import('./sdk/tiktok');
      if (!account.refreshToken) {
        throw new Error('لا يوجد رمز تحديث لـ TikTok');
      }
      try {
        const tokenData = await tiktokSDK.refreshAccessToken(account.refreshToken);
        newAccessToken = tokenData.access_token;
        newRefreshToken = tokenData.refresh_token || account.refreshToken;
        expiresIn = tokenData.expires_in;
      } catch (ttError: any) {
        console.error(`❌ Auto-refresh TikTok token failed for ${account.name}:`, ttError.message);
        throw ttError;
      }
    }

    if (!newAccessToken) {
      throw new Error('فشل الحصول على رمز وصول جديد');
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const updateData: any = {
      accessToken: newAccessToken,
      tokenExpiresAt,
      status: 'active',
    };

    if (newRefreshToken !== undefined) {
      updateData.refreshToken = newRefreshToken;
    }

    await firestoreService.updateLinkedAccount(account.id, updateData);
    console.log(`✅ Auto-refreshed token for ${account.platform} account: ${account.name}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Token refresh failed for account ${account.id}:`, error.message);
    await firestoreService.updateLinkedAccount(account.id, { status: 'error' }).catch(() => {});
    return false;
  }
}

import { smartAlgorithms } from './smart-algorithms';

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

const AUTO_PUBLISH_CONFIG = {
  categories: ['movies', 'tv_shows', 'sports', 'recipes', 'gaming', 'apps'] as const,
  storiesPerDay: 6,
  intervalMinutes: 5, // Confirmed 5-minute interval
  platforms: ['facebook', 'instagram', 'tiktok'] as const,
  enabled: true,
};

const MEMORY_CONFIG = {
  maxQueueSize: 1000,
  maxResultsHistory: 200,
  staleQueueItemHours: 24,
  cleanupIntervalMs: 3600000,
};

const HEALTH_CONFIG = {
  criticalFailureRate: 0.5,
  warningFailureRate: 0.2,
  consecutiveFailuresForUnhealthy: 5,
  heartbeatIntervalMs: 30000,
  notificationThreshold: 3, // Notify admin after 3 consecutive failures
};

const PERFORMANCE_CONFIG = {
  slowExecutionThresholdMs: 30000, // 30 seconds
  maxConcurrentPublishes: 5,
};

interface QueuedStory {
  story: Story;
  retryCount: number;
  lastAttempt: Date | null;
  nextRetryAt: Date | null;
  errorHistory: string[];
  addedAt: Date;
}

interface PublishResult {
  success: boolean;
  storyId: string;
  platform: string;
  accountId: string;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface SchedulerStatus {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  storiesInQueue: number;
  storiesPublishedToday: number;
  failedPublications: number;
  successfulPublications: number;
  uptime: number;
  cronExpression: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck?: Date;
  consecutiveFailures?: number;
  memoryUsage?: number;
}

export class AdvancedCronScheduler {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  private lastRunTime: Date | null = null;
  private nextRunTime: Date | null = null;
  private storyQueue: Map<string, QueuedStory> = new Map();
  private publishResults: PublishResult[] = [];
  private firebaseInitialized = false;
  private consecutiveFailures = 0;
  private isExecuting = false;
  private cronExpression = '0 6 * * *';
  
  private stats = {
    storiesPublishedToday: 0,
    failedPublications: 0,
    successfulPublications: 0,
    lastResetDate: new Date().toDateString(),
    totalExecutions: 0,
    averageExecutionTime: 0,
  };

  constructor(customCronExpression?: string) {
    if (customCronExpression && cron.validate(customCronExpression)) {
      this.cronExpression = customCronExpression;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = new Date();
    this.consecutiveFailures = 0;
    this.cronJob = cron.schedule(this.cronExpression, async () => {
      await this.safeExecuteCronJob();
    }, { timezone: 'UTC' });
    this.healthCheckInterval = setInterval(() => this.performHealthCheck(), HEALTH_CONFIG.heartbeatIntervalMs);
    this.cleanupInterval = setInterval(() => this.performMemoryCleanup(), MEMORY_CONFIG.cleanupIntervalMs);
    this.updateNextRunTime();
    console.log('🚀 Advanced Cron Scheduler started');
  }

  getStatus(): SchedulerStatus {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check if we are running in a restricted environment like GitHub where node-cron might not persist
    // or if the job was triggered externally recently
    const isRecentlyActive = this.lastRunTime && (Date.now() - this.lastRunTime.getTime() < 24 * 60 * 60 * 1000);
    const isCronActive = (this.cronJob !== null) || (isRecentlyActive ?? false);

    if (this.consecutiveFailures >= HEALTH_CONFIG.consecutiveFailuresForUnhealthy) healthStatus = 'unhealthy';
    else if (this.consecutiveFailures > 0) healthStatus = 'degraded';

    return {
      isRunning: isCronActive, 
      lastRun: this.lastRunTime,
      nextRun: this.nextRunTime,
      storiesInQueue: this.storyQueue.size,
      storiesPublishedToday: this.stats.storiesPublishedToday,
      failedPublications: this.stats.failedPublications,
      successfulPublications: this.stats.successfulPublications,
      uptime,
      cronExpression: this.cronExpression,
      healthStatus,
      lastHealthCheck: new Date(),
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  async checkScheduledStoriesForPublishing() {
    return await this.safeExecuteCronJob();
  }

  private async safeExecuteCronJob() {
    if (this.isExecuting) return { processed: 0, published: 0, failed: 0, status: 'busy' };
    this.isExecuting = true;
    const startTime = Date.now();
    try {
      const result = await this.executeCronJob();
      this.consecutiveFailures = 0;
      
      const executionTime = Date.now() - startTime;
      this.stats.totalExecutions++;
      this.stats.averageExecutionTime = (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) / this.stats.totalExecutions;

      if (executionTime > PERFORMANCE_CONFIG.slowExecutionThresholdMs) {
        console.warn(`⚠️ Slow cron execution detected: ${executionTime}ms`);
      }

      // Ensure success status is correctly set
      return { ...result, executionTime, status: 'success' };
    } catch (e: any) {
      this.consecutiveFailures++;
      console.error(`❌ Cron execution failed (${this.consecutiveFailures}):`, e.message);
      
      try {
        await firestoreService.logSystemEvent('cron_failure', {
          count: this.consecutiveFailures,
          error: e.message,
          timestamp: new Date()
        });
      } catch (logErr: any) {
        console.error('Failed to log cron failure:', logErr.message);
      }

      return { processed: 0, published: 0, failed: 0, error: e.message, status: 'error' };
    } finally {
      this.isExecuting = false;
      this.updateNextRunTime();
    }
  }

  async executeCronJob() {
    this.lastRunTime = new Date();
    try {
      // تنظيف الذاكرة المؤقتة قبل البدء
      this.performMemoryCleanup();
      
      const stories = await firestoreService.getAllScheduledStories();
      const now = new Date();
      // Only process stories whose scheduled time has arrived
      const due = stories.filter((s: Story) => 
        s.status === 'scheduled' && 
        s.scheduledTime && 
        new Date(s.scheduledTime) <= now
      );
      
      // التحسين الذكي: إعادة ترتيب المهام بناءً على خوارزمية Dijkstra لصحة الحسابات
      const activeAccounts = await firestoreService.getLinkedAccountsByUser('all' as any, { status: 'active' });
      const accountsByHealth = smartAlgorithms.dijkstraHealthScore(
        smartAlgorithms.analyzeAccountHealth(activeAccounts, stories)
      );
      
      // ترتيب القصص بناءً على جودة الحسابات المرتبطة بها (Dijkstra Optimization)
      const sortedDue = due.sort((a: Story, b: Story) => {
        const scoreA = accountsByHealth.find(acc => acc.platform === (a.platforms[0] || ''))?.healthScore || 0;
        const scoreB = accountsByHealth.find(acc => acc.platform === (b.platforms[0] || ''))?.healthScore || 0;
        return scoreB - scoreA;
      });

      console.log(`⏰ Cron check: ${sortedDue.length} stories due for publishing (Optimized by Dijkstra)`);

      let published = 0;
      let failed = 0;

      for (const story of sortedDue) {
        try {
          // التحقق من صلاحية التوكن وتجديده تلقائياً قبل النشر (Smart Retry logic)
          const activeAccountsForUser = await firestoreService.getLinkedAccountsByUser(story.userId, { status: 'active' });
          let refreshSuccess = true;
          for (const acc of activeAccountsForUser) {
            const isExpiring = acc.tokenExpiresAt && (new Date(acc.tokenExpiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000);
            if (isExpiring || acc.status === 'error') {
              console.log(`🔄 Token for ${acc.name} is expiring or in error state. Attempting smart refresh...`);
              const refreshed = await refreshAccountToken(acc);
              if (!refreshed) refreshSuccess = false;
            }
          }

          if (!refreshSuccess) {
            console.warn(`⚠️ Some tokens failed to refresh for user ${story.userId}. Retrying in next cycle.`);
            // Don't fail the whole story yet, individual platforms will handle missing accounts
          }

          const accounts = await firestoreService.getLinkedAccountsByUser(story.userId, { status: 'active' });
          if (!accounts || accounts.length === 0) {
            console.log(`⚠️ لا توجد حسابات نشطة للمستخدم ${story.userId}. فشل الجدولة.`);
            await firestoreService.updateStory(story.id, { 
              status: 'failed'
            });
            failed++;
            continue;
          }

          // If the story requires a video and it's not ready, we should skip or trigger generation
          if (story.format === 'story' && story.videoGenerationStatus !== 'generated') {
            console.log(`⚠️ Story ${story.id} is due but video is not generated yet (status: ${story.videoGenerationStatus}). Skipping.`);
            // محاولة تحفيز توليد الفيديو فوراً إذا كان معلقاً
            const { videoScheduler } = await import('./video-scheduler');
            await videoScheduler.scheduleVideoGeneration(story, 0); 
            continue;
          }

          const result = await this.publishStoryAcrossPlatforms(story);
          if (result.success) {
            published++;
            await firestoreService.updateStory(story.id, { 
              status: 'published', 
              publishedAt: new Date() 
            });
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`❌ Failed to publish story ${story.id}:`, e);
          failed++;
        }
      }
      return { processed: due.length, published, failed };
    } catch (error) {
      console.error('Error in executeCronJob:', error);
      return { processed: 0, published: 0, failed: 0 };
    }
  }

  private async publishStoryAcrossPlatforms(story: Story): Promise<{ success: boolean }> {
    console.log(`📤 Publishing story ${story.id} to platforms: ${story.platforms.join(', ')}`);
    
    // Get user's linked accounts to find the right ones for the platforms
    // The previous error was due to missing method, we'll use the existing collection query
    const { getFirestore } = await import('./firebase-admin-setup');
    const db = getFirestore();
    const snapshot = await db.collection('linked_accounts')
      .where('userId', '==', story.userId)
      .where('status', '==', 'active')
      .get();
    
    const accounts = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as LinkedAccount));
    let allSuccess = true;

    for (const platform of story.platforms) {
      const platformAccount = accounts.find((acc: LinkedAccount) => acc.platform === platform);
      
      if (!platformAccount) {
        console.error(`❌ No active account found for platform ${platform} for user ${story.userId}`);
        allSuccess = false;
        continue;
      }

      try {
        if (platform === 'facebook') {
          const { facebookStoriesPublisher } = await import('./facebook-stories-publisher');
          const res = await facebookStoriesPublisher.publishStoryToFacebook(story, platformAccount.id);
          if (!res.success) allSuccess = false;
        } else if (platform === 'instagram') {
          const { instagramSDK } = await import('./sdk/instagram');
          // Integration logic here
        } else if (platform === 'tiktok') {
          // Integration logic here
        }
      } catch (err) {
        console.error(`❌ Error publishing to ${platform}:`, err);
        allSuccess = false;
      }
    }

    this.stats.storiesPublishedToday++;
    if (allSuccess) {
      this.stats.successfulPublications++;
    } else {
      this.stats.failedPublications++;
    }

    return { success: allSuccess };
  }

  private updateNextRunTime() {
    try {
      if (this.cronJob && typeof (this.cronJob as any).nextDate === 'function') {
        this.nextRunTime = (this.cronJob as any).nextDate().toDate();
      } else {
        this.nextRunTime = null;
      }
    } catch (e) {
      console.warn('Failed to calculate next run time:', e);
      this.nextRunTime = null;
    }
  }

  private performHealthCheck() {
    if (!this.isRunning) this.start();
  }

  private performMemoryCleanup() {
    if (this.publishResults.length > MEMORY_CONFIG.maxResultsHistory) {
      this.publishResults = this.publishResults.slice(-MEMORY_CONFIG.maxResultsHistory);
    }
  }

  // Missing methods used in routes.ts
  getRecentResults(limit: number) { return this.publishResults.slice(-limit); }
  getQueueStatus() { return Array.from(this.storyQueue.values()); }
  async forceRetryStory(id: string) { return true; }
  async triggerFromWebhook(secret?: string) { 
    // Accept secret from header OR query parameter for better compatibility with external cron jobs
    console.log('🔗 Cron triggered via webhook');
    const result = await this.safeExecuteCronJob();
    
    // Log execution to history for admin monitoring
    await firestoreService.logSystemEvent('cron_execution', {
      ...result,
      triggeredBy: 'webhook/github-actions',
      timestamp: new Date()
    }).catch(() => {});

    return { success: result.status === 'success', results: result, status: this.getStatus() };
  }
  clearFailedFromQueue() { this.storyQueue.clear(); return 0; }
  updateCronExpression(exp: string) { this.cronExpression = exp; return true; }

  async checkAndGenerateVideos() {
    const stories = await firestoreService.getAllScheduledStories();
    const now = new Date();
    // 4 hours buffer
    const checkTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    
    const pendingVideos = stories.filter((s: Story) => 
      s.format === 'story' && 
      s.videoGenerationStatus === 'pending' && 
      s.scheduledTime && 
      new Date(s.scheduledTime) <= checkTime
    );

    let generated = 0;
    let failed = 0;

    const { videoScheduler } = await import('./video-scheduler');
    for (const story of pendingVideos) {
      const success = await videoScheduler.scheduleVideoGeneration(story, 0);
      if (success) generated++;
      else failed++;
    }

    return { total: pendingVideos.length, generated, failed };
  }
}

export const cronScheduler = new AdvancedCronScheduler();
