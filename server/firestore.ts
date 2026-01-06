import { getFirestore } from './firebase-admin-setup';
import type { 
  Story, 
  UserSettings, 
  AdminUser, 
  PlatformIntegration, 
  APIConfig,
  LinkedAccount,
  UserAccountStats,
  StoryAccountAssignment,
  AutoStoryGenerationSettings
} from '@shared/schema';

const firestore = {
  collection: (name: string) => getFirestore().collection(name),
  batch: () => getFirestore().batch(),
};

const COLLECTIONS = {
  STORIES: 'stories',
  SETTINGS: 'settings',
  USERS: 'users',
  INTEGRATIONS: 'integrations',
  API_CONFIGS: 'api_configs',
  LINKED_ACCOUNTS: 'linked_accounts',
  ACCOUNT_STATS: 'account_stats',
  STORY_ASSIGNMENTS: 'story_assignments',
};

export function handleFirestoreError(error: any) {
  if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
    const errorMessage = error.message || error.toString();
    
    const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
    
    if (urlMatch) {
      const indexUrl = urlMatch[0];
      console.log('\n' + '='.repeat(80));
      console.log('🔥 FIREBASE INDEX REQUIRED - انقر على الرابط لإنشاء Index تلقائياً 🔥');
      console.log('='.repeat(80));
      console.log('\nيجب إنشاء Firestore Index لكي تعمل هذه الميزة.');
      console.log('\n📌 انقر على الرابط التالي لإنشاء Index تلقائياً:\n');
      console.log('   👉 ' + indexUrl + '\n');
      console.log('بعد النقر على الرابط:');
      console.log('  1️⃣  انقر على زر "Create Index"');
      console.log('  2️⃣  انتظر 5-10 دقائق حتى يكتمل الإنشاء');
      console.log('  3️⃣  أعد تشغيل التطبيق أو جرب مرة أخرى');
      console.log('\n' + '='.repeat(80) + '\n');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('🔥 FIREBASE INDEX REQUIRED 🔥');
      console.log('='.repeat(80));
      console.log('\nFirestore Index مطلوب. راجع FIREBASE_SETUP.md للتفاصيل.');
      console.log('رسالة الخطأ الكاملة:');
      console.log(errorMessage);
      console.log('\n' + '='.repeat(80) + '\n');
    }
    
    throw new Error('Firestore Index مطلوب. راجع console logs للحصول على رابط الإنشاء التلقائي.');
  }
  
  throw error;
}

export class FirestoreService {
  async updateAutoStorySettings(settings: Partial<AutoStoryGenerationSettings>) {
    await firestore.collection(COLLECTIONS.SETTINGS).doc('auto-story-global').set(settings, { merge: true });
  }

  async getAutoStorySettings(): Promise<AutoStoryGenerationSettings | null> {
    const docSnap = await firestore.collection(COLLECTIONS.SETTINGS).doc('auto-story-global').get();
    if (!docSnap.exists) return null;
    return docSnap.data() as AutoStoryGenerationSettings;
  }

  async createStory(userId: string, story: Omit<Story, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    const storyData = {
      ...story,
      userId,
      status: 'scheduled' as const,
      format: story.format || 'story' as const,
      videoGenerationStatus: story.videoGenerationStatus || 'pending' as const,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore.collection(COLLECTIONS.STORIES).add(storyData);
    return { id: docRef.id, ...storyData };
  }

  async getStoriesByUser(userId: string, limitCount = 50) {
    try {
      let query = firestore.collection(COLLECTIONS.STORIES);
      
      // If we are looking for user stories, also include system-auto-publish stories
      if (userId !== 'system-auto-publish') {
        const snapshot = await firestore
          .collection(COLLECTIONS.STORIES)
          .where('userId', 'in', [userId, 'system-auto-publish'])
          .orderBy('createdAt', 'desc')
          .limit(limitCount)
          .get();

        return snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            format: data.format || 'story',
            videoGenerationStatus: data.videoGenerationStatus || 'pending',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
            scheduledTime: data.scheduledTime?.toDate ? data.scheduledTime.toDate() : new Date(data.scheduledTime),
          } as Story;
        });
      }

      const snapshot = await firestore
        .collection(COLLECTIONS.STORIES)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();

      return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          format: data.format || 'story',
          videoGenerationStatus: data.videoGenerationStatus || 'pending',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          scheduledTime: data.scheduledTime?.toDate ? data.scheduledTime.toDate() : new Date(data.scheduledTime),
        } as Story;
      });
    } catch (error) {
      handleFirestoreError(error);
      throw error;
    }
  }

  async getRecentScheduledStoriesByUser(userId: string, limitCount = 5) {
    try {
      const snapshot = await firestore
        .collection(COLLECTIONS.STORIES)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const allStories = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          format: data.format || 'story',
          videoGenerationStatus: data.videoGenerationStatus || 'pending',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          scheduledTime: data.scheduledTime?.toDate ? data.scheduledTime.toDate() : new Date(data.scheduledTime),
        } as Story;
      });

      const scheduledStories = allStories
        .filter((story: Story) => story.status === 'scheduled')
        .sort((a: Story, b: Story) => {
          const timeA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
          const timeB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, limitCount);

      return scheduledStories;
    } catch (error) {
      handleFirestoreError(error);
      throw error;
    }
  }

  async getStoryById(id: string) {
    const docSnap = await firestore.collection(COLLECTIONS.STORIES).doc(id).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      ...data,
      format: data.format || 'story',
      videoGenerationStatus: data.videoGenerationStatus || 'pending',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      scheduledTime: data.scheduledTime?.toDate ? data.scheduledTime.toDate() : new Date(data.scheduledTime),
    } as Story;
  }

  async updateStory(id: string, updates: Partial<Story>) {
    await firestore.collection(COLLECTIONS.STORIES).doc(id).update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deleteStory(id: string) {
    await firestore.collection(COLLECTIONS.STORIES).doc(id).delete();
  }

  async deleteAllFailedStories(): Promise<number> {
    const snapshot = await firestore
      .collection(COLLECTIONS.STORIES)
      .where('status', '==', 'failed')
      .get();

    const batch = firestore.batch();
    snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.docs.length;
  }

  private static schedulerWarningShown = false;
  private static lastSchedulerWarningTime = 0;
  private static readonly SCHEDULER_WARNING_INTERVAL = 300000; // 5 minutes

  private shouldShowSchedulerWarning(): boolean {
    const now = Date.now();
    if (!FirestoreService.schedulerWarningShown || 
        (now - FirestoreService.lastSchedulerWarningTime > FirestoreService.SCHEDULER_WARNING_INTERVAL)) {
      FirestoreService.lastSchedulerWarningTime = now;
      FirestoreService.schedulerWarningShown = true;
      return true;
    }
    return false;
  }

  async getAllScheduledStories() {
    try {
      if (!firestore) {
        return [];
      }

      const snapshot = await firestore
        .collection(COLLECTIONS.STORIES)
        .where('status', '==', 'scheduled')
        .get();

      return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          format: data.format || 'story',
          videoGenerationStatus: data.videoGenerationStatus || 'pending',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          scheduledTime: data.scheduledTime?.toDate ? data.scheduledTime.toDate() : new Date(data.scheduledTime),
        } as Story;
      });
    } catch (error: any) {
      if (error.message?.includes('Project') || error.message?.includes('authentication')) {
        if (this.shouldShowSchedulerWarning()) {
          console.warn('⚠️  Firebase not configured - Story scheduler waiting for setup');
        }
      } else {
        console.error('Error getting scheduled stories:', error);
      }
      return [];
    }
  }

  async getUserSettings(userId: string) {
    if (!firestore) {
      console.warn('⚠️  Firestore not initialized');
      return null;
    }
    const docSnap = await firestore.collection(COLLECTIONS.SETTINGS).doc(userId).get();

    if (!docSnap.exists) {
      const defaultSettings: UserSettings = {
        userId,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        publicProfile: false,
        showActivity: false,
        autoPublish: true,
        preferredPublishTime: '12:00',
        autoStoryGenerationEnabled: false,
        autoStoryWithMusic: true,
        autoStoryWithVideo: false,
      };
      await firestore.collection(COLLECTIONS.SETTINGS).doc(userId).set(defaultSettings);
      return defaultSettings;
    }

    return docSnap.data() as UserSettings;
  }

  async updateUserSettings(userId: string, settings: Partial<UserSettings>) {
    await firestore.collection(COLLECTIONS.SETTINGS).doc(userId).set(settings, { merge: true });
  }

  async getUserById(id: string) {
    const docSnap = await firestore.collection(COLLECTIONS.USERS).doc(id).get();
    if (!docSnap.exists) return null;
    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    };
  }

  async updateUser(id: string, updates: any) {
    await firestore.collection(COLLECTIONS.USERS).doc(id).set({
      ...updates,
      updatedAt: new Date(),
    }, { merge: true });
  }

  async getAllUsers() {
    const snapshot = await firestore.collection(COLLECTIONS.USERS).get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      } as AdminUser;
    });
  }

  async getPlatformIntegrations() {
    const snapshot = await firestore.collection(COLLECTIONS.INTEGRATIONS).get();

    if (snapshot.empty) {
      const defaultIntegrations: PlatformIntegration[] = [
        { platform: 'facebook', enabled: true, moderationEnabled: false },
        { platform: 'instagram', enabled: true, moderationEnabled: false },
        { platform: 'tiktok', enabled: true, moderationEnabled: false },
      ];

      for (const integration of defaultIntegrations) {
        await firestore.collection(COLLECTIONS.INTEGRATIONS).doc(integration.platform).set(integration);
      }

      return defaultIntegrations;
    }

    return snapshot.docs.map((doc: any) => doc.data()) as PlatformIntegration[];
  }

  async updatePlatformIntegration(platform: string, updates: Partial<PlatformIntegration>) {
    await firestore.collection(COLLECTIONS.INTEGRATIONS).doc(platform).set(updates, { merge: true });
  }

  async getAPIConfigs() {
    const snapshot = await firestore.collection(COLLECTIONS.API_CONFIGS).get();

    if (snapshot.empty) {
      const defaultConfigs: APIConfig[] = [
        { provider: 'facebook', appId: '', appSecret: '', isConnected: false },
        { provider: 'instagram', appId: '', appSecret: '', isConnected: false },
        { provider: 'tiktok', apiKey: '', appSecret: '', isConnected: false },
        { provider: 'deepseek', apiKey: '', isConnected: false },
        { provider: 'cloudflare_r2', isConnected: false, additionalConfig: {} },
        { provider: 'youtube', apiKey: '', isConnected: false },
        { provider: 'huggingface', apiKey: '', isConnected: false },
        { provider: 'gemini', apiKey: '', isConnected: false },
        { provider: 'google_trends', apiKey: '', isConnected: false, additionalConfig: { searchEngineId: '' } },
        { provider: 'tmdb', apiKey: '', isConnected: false },
      ];

      for (const config of defaultConfigs) {
        await firestore.collection(COLLECTIONS.API_CONFIGS).doc(config.provider).set(config);
      }

      return defaultConfigs;
    }

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        lastTested: data.lastTested?.toDate ? data.lastTested.toDate() : undefined,
      } as APIConfig;
    });
  }

  async getAPIConfig(provider: string) {
    const docSnap = await firestore.collection(COLLECTIONS.API_CONFIGS).doc(provider).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data()!;
    return {
      ...data,
      lastTested: data.lastTested?.toDate ? data.lastTested.toDate() : undefined,
    } as APIConfig;
  }

  async updateAPIConfig(provider: string, updates: Partial<APIConfig>) {
    const current = await this.getAPIConfig(provider);
    
    const updateData: any = {
      provider,
      isConnected: current?.isConnected ?? false,
    };
    
    if (updates.apiKey !== undefined) updateData.apiKey = updates.apiKey;
    if (updates.appId !== undefined) updateData.appId = updates.appId;
    if (updates.appSecret !== undefined) updateData.appSecret = updates.appSecret;
    if (updates.redirectUrl !== undefined) updateData.redirectUrl = updates.redirectUrl;
    if (updates.additionalConfig !== undefined) {
      updateData.additionalConfig = {
        ...(current?.additionalConfig || {}),
        ...updates.additionalConfig,
      };
    }
    if (updates.isConnected !== undefined) updateData.isConnected = updates.isConnected;
    if (updates.lastTested !== undefined) updateData.lastTested = updates.lastTested;
    
    await firestore.collection(COLLECTIONS.API_CONFIGS).doc(provider).set(updateData, { merge: true });
  }

  async createLinkedAccount(userId: string, account: Omit<LinkedAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const stats = await this.getUserAccountStats(userId);
    
    if (stats.totalAccounts >= stats.maxAccounts) {
      throw new Error(`لقد وصلت إلى الحد الأقصى للحسابات المسموح بها (${stats.maxAccounts})`);
    }

    const now = new Date();
    const accountData = {
      ...account,
      userId,
      status: 'active' as const,
      quotas: account.quotas || {
        dailyLimit: 50,
        dailyUsed: 0,
        monthlyLimit: 1000,
        monthlyUsed: 0,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore.collection(COLLECTIONS.LINKED_ACCOUNTS).add(accountData);
    
    await this.updateUserAccountStats(userId);
    
    return { id: docRef.id, ...accountData };
  }

  async getLinkedAccountsByUser(
    userId: string, 
    options?: { 
      platform?: string; 
      status?: string; 
      limit?: number; 
      startAfter?: string;
      search?: string;
    }
  ) {
    try {
      let query: any = firestore
        .collection(COLLECTIONS.LINKED_ACCOUNTS)
        .where('userId', '==', userId);

      if (options?.platform) {
        query = query.where('platform', '==', options.platform);
      }

      if (options?.status) {
        query = query.where('status', '==', options.status);
      }

      // We remove the orderBy('createdAt') to avoid needing a composite index for simple filtering
      // or we just don't sort if we have other filters.
      // Firestore requires composite indexes for queries with multiple filters and an inequality or sorting.
      // By removing the sort, we can often avoid the composite index requirement for simple filters.
      if (!options?.status && !options?.platform) {
        query = query.orderBy('createdAt', 'desc');
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.startAfter) {
        const startDoc = await firestore.collection(COLLECTIONS.LINKED_ACCOUNTS).doc(options.startAfter).get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      const snapshot = await query.get();

      let accounts = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          tokenExpiresAt: data.tokenExpiresAt?.toDate ? data.tokenExpiresAt.toDate() : undefined,
          lastSyncedAt: data.lastSyncedAt?.toDate ? data.lastSyncedAt.toDate() : undefined,
          lastPublishedAt: data.lastPublishedAt?.toDate ? data.lastPublishedAt.toDate() : undefined,
          quotas: {
            ...data.quotas,
            resetAt: data.quotas?.resetAt?.toDate ? data.quotas.resetAt.toDate() : new Date(),
          },
        } as LinkedAccount;
      });

      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        accounts = accounts.filter((acc: LinkedAccount) => 
          acc.name.toLowerCase().includes(searchLower) ||
          acc.username?.toLowerCase().includes(searchLower) ||
          acc.externalId.includes(searchLower)
        );
      }

      return accounts;
    } catch (error) {
      handleFirestoreError(error);
      throw error;
    }
  }

  async getLinkedAccountById(id: string) {
    const docSnap = await firestore.collection(COLLECTIONS.LINKED_ACCOUNTS).doc(id).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      tokenExpiresAt: data.tokenExpiresAt?.toDate ? data.tokenExpiresAt.toDate() : undefined,
      lastSyncedAt: data.lastSyncedAt?.toDate ? data.lastSyncedAt.toDate() : undefined,
      lastPublishedAt: data.lastPublishedAt?.toDate ? data.lastPublishedAt.toDate() : undefined,
      quotas: {
        ...data.quotas,
        resetAt: data.quotas?.resetAt?.toDate ? data.quotas.resetAt.toDate() : new Date(),
      },
    } as LinkedAccount;
  }

  async updateLinkedAccount(id: string, updates: Partial<LinkedAccount>) {
    await firestore.collection(COLLECTIONS.LINKED_ACCOUNTS).doc(id).update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deleteLinkedAccount(id: string, userId: string) {
    const account = await this.getLinkedAccountById(id);
    if (!account || account.userId !== userId) {
      throw new Error('الحساب غير موجود أو ليس لديك صلاحية لحذفه');
    }

    await firestore.collection(COLLECTIONS.LINKED_ACCOUNTS).doc(id).delete();
    
    const assignmentsSnapshot = await firestore
      .collection(COLLECTIONS.STORY_ASSIGNMENTS)
      .where('accountId', '==', id)
      .get();
    
    const batch = firestore.batch();
    assignmentsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(doc.ref));
    await batch.commit();

    await this.updateUserAccountStats(userId);
  }

  async getAccountsNeedingTokenRefresh() {
    try {
      const now = new Date();
      const snapshot = await firestore
        .collection(COLLECTIONS.LINKED_ACCOUNTS)
        .where('status', '==', 'active')
        .get();

      return snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
            tokenExpiresAt: data.tokenExpiresAt?.toDate ? data.tokenExpiresAt.toDate() : undefined,
          } as LinkedAccount;
        })
        .filter((account: LinkedAccount) => {
          if (!account.tokenExpiresAt) return false;
          const expiresAt = new Date(account.tokenExpiresAt);
          const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
          return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
        });
    } catch (error) {
      console.error('خطأ في الحصول على الحسابات المنتهية الصلاحية:', error);
      return [];
    }
  }

  async getUserAccountStats(userId: string): Promise<UserAccountStats> {
    const docSnap = await firestore.collection(COLLECTIONS.ACCOUNT_STATS).doc(userId).get();

    if (!docSnap.exists) {
      const defaultStats: UserAccountStats = {
        userId,
        totalAccounts: 0,
        facebookAccounts: 0,
        instagramAccounts: 0,
        tiktokAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
        maxAccounts: 1000,
        updatedAt: new Date(),
      };
      await firestore.collection(COLLECTIONS.ACCOUNT_STATS).doc(userId).set(defaultStats);
      return defaultStats;
    }

    const data = docSnap.data()!;
    return {
      ...data,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    } as UserAccountStats;
  }

  async updateUserAccountStats(userId: string) {
    const accounts = await this.getLinkedAccountsByUser(userId);
    const stories = await this.getStoriesByUser(userId, 100);
    const publishedStories = stories.filter((s: Story) => s.status === 'published');

    // Calculate real metrics from accounts and stories
    const totalFollowers = accounts.reduce((sum: number, acc: LinkedAccount) => {
      // Use profile data if available (assuming 'followers' field exists or fallback to 0)
      return sum + ((acc as any).followers || 0);
    }, 0);

    const totalReach = publishedStories.reduce((sum: number, s: any) => sum + (Number(s.reach) || 0), 0);
    const totalEngagement = publishedStories.reduce((sum: number, s: Story) => sum + (Number(s.engagementRate) || 0), 0);
    const avgEngagement = publishedStories.length > 0 ? totalEngagement / publishedStories.length : 0;

    const stats: UserAccountStats = {
      userId,
      totalAccounts: accounts.length,
      facebookAccounts: accounts.filter((a: LinkedAccount) => a.platform === 'facebook').length,
      instagramAccounts: accounts.filter((a: LinkedAccount) => a.platform === 'instagram').length,
      tiktokAccounts: accounts.filter((a: LinkedAccount) => a.platform === 'tiktok').length,
      activeAccounts: accounts.filter((a: LinkedAccount) => a.status === 'active').length,
      inactiveAccounts: accounts.filter((a: LinkedAccount) => a.status !== 'active').length,
      totalFollowers,
      totalReach,
      avgEngagement,
      totalPosts: publishedStories.length,
      growthRate: 0,
      maxAccounts: 1000,
      updatedAt: new Date(),
    };

    // Force sync stats on user document as well for historical reasons
    const userRef = firestore.collection(COLLECTIONS.USERS).doc(userId);
    await userRef.set({
      stats: {
        totalFollowers,
        totalReach,
        avgEngagement,
        activeAccounts: stats.activeAccounts,
        lastStatsUpdate: new Date()
      },
      aggregateStats: {
        totalFollowers,
        totalReach,
        avgEngagement,
        lastUpdated: new Date()
      }
    }, { merge: true });

    await firestore.collection(COLLECTIONS.ACCOUNT_STATS).doc(userId).set(stats);
    return stats;
  }

  async assignAccountToStory(storyId: string, accountId: string) {
    const now = new Date();
    const assignmentData: Omit<StoryAccountAssignment, 'id'> = {
      storyId,
      accountId,
      assignedAt: now,
      status: 'pending',
    };

    const docRef = await firestore.collection(COLLECTIONS.STORY_ASSIGNMENTS).add(assignmentData);
    return { id: docRef.id, ...assignmentData };
  }

  async getStoryAssignments(storyId: string) {
    const snapshot = await firestore
      .collection(COLLECTIONS.STORY_ASSIGNMENTS)
      .where('storyId', '==', storyId)
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        assignedAt: data.assignedAt?.toDate ? data.assignedAt.toDate() : new Date(data.assignedAt),
        publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : undefined,
      } as StoryAccountAssignment;
    });
  }

  async getAccountAssignments(accountId: string) {
    const snapshot = await firestore
      .collection(COLLECTIONS.STORY_ASSIGNMENTS)
      .where('accountId', '==', accountId)
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        assignedAt: data.assignedAt?.toDate ? data.assignedAt.toDate() : new Date(data.assignedAt),
        publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : undefined,
      } as StoryAccountAssignment;
    });
  }

  async updateAssignmentStatus(storyId: string, accountId: string, status: 'published' | 'failed', error?: string) {
    const snapshot = await firestore
      .collection(COLLECTIONS.STORY_ASSIGNMENTS)
      .where('storyId', '==', storyId)
      .where('accountId', '==', accountId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return;
    }

    const doc = snapshot.docs[0];
    const updateData: { status: string; publishedAt?: Date; error?: string } = { status };
    if (status === 'published') {
      updateData.publishedAt = new Date();
    }
    if (error !== undefined) {
      updateData.error = error;
    }
    await doc.ref.update(updateData);
  }

  async removeStoryAssignment(storyId: string, accountId: string) {
    const snapshot = await firestore
      .collection(COLLECTIONS.STORY_ASSIGNMENTS)
      .where('storyId', '==', storyId)
      .where('accountId', '==', accountId)
      .get();

    const batch = firestore.batch();
    snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(doc.ref));
    await batch.commit();
  }

  async getActiveLinkedAccounts(): Promise<LinkedAccount[]> {
    try {
      const snapshot = await firestore
        .collection(COLLECTIONS.LINKED_ACCOUNTS)
        .where('status', '==', 'active')
        .get();

      return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          tokenExpiresAt: data.tokenExpiresAt?.toDate ? data.tokenExpiresAt.toDate() : undefined,
          lastSyncedAt: data.lastSyncedAt?.toDate ? data.lastSyncedAt.toDate() : undefined,
          lastPublishedAt: data.lastPublishedAt?.toDate ? data.lastPublishedAt.toDate() : undefined,
          quotas: {
            ...data.quotas,
            resetAt: data.quotas?.resetAt?.toDate ? data.quotas.resetAt.toDate() : new Date(),
          },
        } as LinkedAccount;
      });
    } catch (error) {
      handleFirestoreError(error);
      throw error;
    }
  }

  async logSystemEvent(type: string, data: any) {
    try {
      const db = getFirestore();
      await db.collection('system_logs').add({
        type,
        data,
        timestamp: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Error logging system event:', error);
      return false;
    }
  }

  async createAutoStory(storyData: {
    content: string;
    category: string;
    platforms: ('facebook' | 'instagram' | 'tiktok')[];
    scheduledTime: Date;
    format: 'story' | 'reel' | 'post';
    mediaUrl: string;
    mediaType: 'image' | 'video';
    trendingTopic?: string;
    posterTitle?: string;
    latestEpisode?: number;
    facebookPngUrl?: string;
    instagramPngUrl?: string;
    tiktokWebpUrl?: string;
    originCountry?: string;
  }): Promise<string> {
    const now = new Date();
    const data = {
      ...storyData,
      userId: 'system-auto-publish',
      status: 'scheduled' as const,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore.collection(COLLECTIONS.STORIES).add(data);
    return docRef.id;
  }

  async assignStoryToAccount(storyId: string, accountId: string): Promise<void> {
    const now = new Date();
    const assignmentData: Omit<StoryAccountAssignment, 'id'> = {
      storyId,
      accountId,
      assignedAt: now,
      status: 'pending',
    };

    await firestore.collection(COLLECTIONS.STORY_ASSIGNMENTS).add(assignmentData);
  }
}

export const firestoreService = new FirestoreService();
