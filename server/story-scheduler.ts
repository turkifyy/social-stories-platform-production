import { firestoreService } from './firestore';
import { r2Storage } from './r2-storage';
import { storyMusicService } from './story-music-service';
import type { Story, LinkedAccount } from '@shared/schema';

export class StoryScheduler {
  private isRunning = false;
  private checkInterval = 60000; // Check every minute
  private firebaseWarningShown = false;
  private lastWarningTime = 0;
  private warningIntervalMs = 300000; // Show warning only every 5 minutes

  private processingStoryIds: Set<string> = new Set();

  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('📅 Story scheduler started - checking for scheduled stories every minute');
    
    this.scheduleNextCheck();
  }

  private shouldShowWarning(): boolean {
    const now = Date.now();
    if (!this.firebaseWarningShown || (now - this.lastWarningTime > this.warningIntervalMs)) {
      this.lastWarningTime = now;
      this.firebaseWarningShown = true;
      return true;
    }
    return false;
  }

  private scheduleNextCheck() {
    if (!this.isRunning) return;

    setTimeout(async () => {
      try {
        await this.processScheduledStories();
      } catch (error: any) {
        if (error.message?.includes('Project Id')) {
          if (this.shouldShowWarning()) {
            console.warn('⚠️  Firebase Project ID not configured - Story scheduler paused until setup complete');
          }
        } else {
          console.error('Error processing scheduled stories:', error);
        }
      }
      this.scheduleNextCheck();
    }, this.checkInterval);
  }

  async processScheduledStories() {
    try {
      let allScheduledStories = [];
      try {
        allScheduledStories = await firestoreService.getAllScheduledStories();
      } catch (error: any) {
        if (error.message?.includes('Project Id') || error.message?.includes('authentication')) {
          console.warn('⚠️  Firestore not initialized - waiting for Firebase setup');
          return;
        }
        throw error;
      }
      
      const now = new Date();
      
      // Helper to convert UTC to Saudi time for display only
      const formatTimeInSaudi = (utcTime: Date): string => {
        const saudiOffsetMs = 3 * 60 * 60 * 1000;
        const saudiTime = new Date(utcTime.getTime() + saudiOffsetMs);
        return saudiTime.toISOString();
      };
      
      console.log(`\n📋 === STORY SCHEDULER CHECK (Every 1 minute) ===`);
      console.log(`   🕐 Current UTC Time: ${now.toISOString()}`);
      console.log(`   🕐 Current Saudi Arabia Time (UTC+3): ${formatTimeInSaudi(now)}`);
      console.log(`   📚 Total stories in Firestore: ${allScheduledStories.length}`);
      
      if (allScheduledStories.length > 0) {
        console.log(`\n   📝 All Scheduled Stories:`);
        allScheduledStories.forEach((s: Story, idx: number) => {
          const storyTime = new Date(s.scheduledTime!);
          const status = s.status || 'unknown';
          const isDue = storyTime <= now;
          console.log(`      [${idx + 1}] ID: ${s.id}`);
          console.log(`          Status: ${status}`);
          console.log(`          Scheduled UTC: ${storyTime.toISOString()}`);
          console.log(`          Scheduled Saudi (UTC+3): ${formatTimeInSaudi(storyTime)}`);
          console.log(`          Is Due? ${isDue ? '✅ YES' : '❌ NO'}`);
          console.log(`          Platforms: ${s.platforms.join(', ')}`);
        });
      }
      
      const duePosts = allScheduledStories.filter((story: Story) => {
        if (!story.scheduledTime) return false;
        
        // Skip stories that are already published, failed, or currently processing
        const status = story.status;
        if (status === 'published' || status === 'failed') return false;
        
        // Prevent race conditions with an "in-flight" check
        if (this.processingStoryIds.has(story.id)) return false;

        const scheduledTimeInUTC = new Date(story.scheduledTime);
        return scheduledTimeInUTC <= now;
      });

      if (duePosts.length === 0) {
        console.log(`\n   ⏳ No stories due for publishing at this moment`);
        console.log(`═══════════════════════════════════════════\n`);
        return;
      }

      console.log(`\n   ✅ FOUND ${duePosts.length} STORIES READY TO PUBLISH!`);
      for (const story of duePosts) {
        console.log(`\n   🚀 Publishing story: ${story.id}`);
        this.processingStoryIds.add(story.id);
        try {
          await this.publishStory(story);
        } finally {
          this.processingStoryIds.delete(story.id);
        }
      }
      console.log(`═══════════════════════════════════════════\n`);
    } catch (error) {
      console.error('Error in processScheduledStories:', error);
    }
  }

  private async publishStory(story: Story) {
    try {
      console.log(`\n      📝 === PUBLISHING STORY ===`);
      console.log(`         Story ID: ${story.id}`);
      console.log(`         Title: ${story.content.substring(0, 50)}...`);
      console.log(`         Platforms: ${story.platforms.join(', ')}`);
      console.log(`         Media Type: ${story.mediaType || 'unknown'}`);
      console.log(`         Has Music: ${!!(story as any).musicUrl}`);
      
      const assignments = await firestoreService.getStoryAssignments(story.id);
      
      console.log(`         Assigned Accounts: ${assignments.length}`);
      if (assignments.length === 0) {
        console.log(`         ⚠️  NO ACCOUNTS ASSIGNED - Skipping...`);
        await firestoreService.updateStory(story.id, { 
          status: 'failed' as const 
        });
        return;
      }

      let hasAnySuccess = false;
      let hasAnyFailure = false;
      const successfulPlatforms: string[] = [];

      for (const assignment of assignments) {
        console.log(`\n      🔗 Processing Assignment:`);
        console.log(`         Account ID: ${assignment.accountId}`);
        console.log(`         Status: ${assignment.status}`);
        
        const account = await firestoreService.getLinkedAccountById(assignment.accountId);
        
        if (!account) {
          console.log(`         ❌ Account NOT FOUND in Firestore`);
          await firestoreService.updateAssignmentStatus(
            story.id, 
            assignment.accountId, 
            'failed',
            'الحساب المرتبط غير موجود'
          );
          hasAnyFailure = true;
          continue;
        }

        console.log(`         ✅ Account Found: ${account.name}`);
        console.log(`            Platform: ${account.platform}`);
        console.log(`            Status: ${account.status}`);
        console.log(`            External ID: ${account.externalId}`);
        console.log(`            Has Access Token: ${!!account.accessToken}`);

        if (account.status !== 'active') {
          console.log(`         ❌ Account is NOT ACTIVE (Status: ${account.status})`);
          await firestoreService.updateAssignmentStatus(
            story.id,
            assignment.accountId,
            'failed',
            'الحساب غير نشط'
          );
          hasAnyFailure = true;
          continue;
        }

        if (!story.platforms.includes(account.platform)) {
          console.log(`         ⚠️  Story NOT scheduled for platform ${account.platform}`);
          continue;
        }

        try {
          console.log(`         🚀 Starting publish to ${account.platform}...`);
          const publishResult = await this.publishToAccount(story, account);
          
          // تحديث بيانات الحساب بآخر وقت نشر
          await firestoreService.updateLinkedAccount(account.id, {
            lastPublishedAt: new Date(),
            quotas: {
              dailyLimit: account.quotas?.dailyLimit || 50,
              dailyUsed: (account.quotas?.dailyUsed || 0) + 1,
              monthlyLimit: account.quotas?.monthlyLimit || 1000,
              monthlyUsed: (account.quotas?.monthlyUsed || 0) + 1,
              resetAt: account.quotas?.resetAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
            }
          });

          await firestoreService.updateAssignmentStatus(
            story.id,
            assignment.accountId,
            'published'
          );
          hasAnySuccess = true;
          if (!successfulPlatforms.includes(account.platform)) {
            successfulPlatforms.push(account.platform);
          }
          console.log(`         ✅ PUBLISHED SUCCESSFULLY to ${account.platform}!`);
        } catch (error: any) {
          console.error(`         ❌ PUBLISH FAILED to ${account.platform}:`);
          console.error(`            Error: ${error.message}`);
          await firestoreService.updateAssignmentStatus(
            story.id,
            assignment.accountId,
            'failed',
            error.message
          );
          hasAnyFailure = true;
        }
      }

      let finalStatus: 'published' | 'failed';
      if (hasAnySuccess && !hasAnyFailure) {
        finalStatus = 'published';
      } else if (hasAnySuccess && hasAnyFailure) {
        finalStatus = 'published';
      } else {
        finalStatus = 'failed';
      }

      const updateData: { status: 'published' | 'failed'; publishedAt?: Date; publishedPlatforms?: (typeof import('@shared/schema').platforms[number])[] } = {
        status: finalStatus,
      };
      if (hasAnySuccess) {
        updateData.publishedAt = new Date();
        updateData.publishedPlatforms = successfulPlatforms as (typeof import('@shared/schema').platforms[number])[];
      }
      await firestoreService.updateStory(story.id, updateData);

      console.log(`      📊 Story ${story.id} FINAL STATUS: ${finalStatus === 'published' ? '✅ PUBLISHED' : '❌ FAILED'}`);
    } catch (error: any) {
      console.error(`      ❌ Error publishing story ${story.id}:`, error);
      await firestoreService.updateStory(story.id, { 
        status: 'failed' as const 
      });
    }
  }

  private isR2Url(url: string): boolean {
    return url.includes('.r2.cloudflarestorage.com') || url.includes('r2.dev');
  }

  private async refreshMediaUrls(story: Story): Promise<Story> {
    const refreshedStory = { ...story };
    
    if (story.mediaUrl) {
      if (this.isR2Url(story.mediaUrl)) {
        console.log(`🔄 Refreshing main media URL for story ${story.id}...`);
        
        const verification = await r2Storage.verifyAndGetUrl(story.mediaUrl);
        if (!verification.valid) {
          console.error(`❌ الملف غير موجود في التخزين السحابي: ${verification.error}`);
          throw new Error(`الملف غير موجود في التخزين السحابي. يرجى إعادة توليد الصورة. (${verification.fileKey || story.mediaUrl})`);
        }
        
        if (verification.freshUrl) {
          refreshedStory.mediaUrl = verification.freshUrl;
          console.log(`   ✅ URL refreshed successfully`);
        }
      } else {
        console.log(`ℹ️ Main media URL is not from R2: ${story.mediaUrl.substring(0, 80)}...`);
      }
    }
    
    return refreshedStory;
  }

  private async publishToAccount(story: Story, account: LinkedAccount) {
    const { PublishingErrorHandler } = await import('./error-handler');
    const { FileValidator } = await import('./file-validator');
    
    const platform = account.platform;
    const format = story.format || 'story';
    
    // ✅ FIX #1: Validate account before publishing
    const validation = await PublishingErrorHandler.validateStoryForPublishing(story, account);
    if (!validation.valid) {
      throw new Error(validation.errors.join('\n'));
    }
    
    // ✅ FIX #4: Check and refresh expired tokens
    if (PublishingErrorHandler.isTokenExpired(account)) {
      const refreshedAccount = await PublishingErrorHandler.refreshAccountTokenIfNeeded(account);
      if (!refreshedAccount) {
        throw new Error(`انتهت صلاحية رمز الدخول. يرجى تحديث الحساب "${account.name}"`);
      }
      // Use the refreshed token
      account = refreshedAccount;
    }
    
    if (story.mediaUrl && story.mediaUrl.startsWith('blob:')) {
      throw new Error('لا يمكن نشر ملفات محلية. يجب رفع الملفات إلى خدمة تخزين سحابية أولاً.');
    }

    // ✅ FIX #3: Validate and refresh R2 URLs before publishing
    const refreshedStory = await this.refreshMediaUrls(story);
    
    // ✅ FIX #1: Validate URLs
    if (refreshedStory.mediaUrl && !PublishingErrorHandler.isValidUrl(refreshedStory.mediaUrl)) {
      throw new Error(`رابط الملف غير صالح: ${refreshedStory.mediaUrl}`);
    }
    
    // ✅ FIX #3: Check URL expiration and refresh if needed
    if (refreshedStory.mediaUrl) {
      const freshUrl = await FileValidator.refreshUrlIfNeeded(refreshedStory.mediaUrl);
      refreshedStory.mediaUrl = freshUrl;
    }
    
    if (platform === 'facebook') {
      const { facebookSDK } = await import('./sdk/facebook');
      
      const facebookImageUrl = (refreshedStory as any).facebookPngUrl || refreshedStory.mediaUrl;
      
      if (format === 'story') {
        if (!facebookImageUrl || !facebookImageUrl.startsWith('http')) {
          throw new Error('يجب إضافة رابط صورة أو فيديو صالح من الإنترنت للنشر كـ Story على Facebook');
        }
        
        if (refreshedStory.mediaType === 'image') {
          console.log(`📸 Publishing to Facebook Story with 20-second duration...`);
          
          // Try to create a 20-second story video with music if available
          let storyToPublish: any = { photo_url: facebookImageUrl };
          
          try {
            const musicUrl = (refreshedStory as any).musicUrl;
            console.log(`🎵 Attempting to create 20-second story video${musicUrl ? ' with music' : ' without music'}...`);
            const storyVideo = await storyMusicService.createStoryWithMusic(
              facebookImageUrl,
              refreshedStory.content.substring(0, 50),
              refreshedStory.category,
              musicUrl
            );
            
            if (storyVideo) {
              console.log(`✅ Successfully created 20-second story video with ${storyVideo.hasMusic ? 'music' : 'animation'}`);
              console.log(`   Video Duration: 20 seconds`);
              storyToPublish = { video_url: storyVideo.url };
              refreshedStory.mediaType = 'video';
            } else {
              console.warn(`⚠️ createStoryWithMusic returned null, publishing image instead`);
            }
          } catch (musicError: any) {
            console.error(`❌ Error creating story with music: ${musicError.message}`);
            console.log(`⚠️ Falling back to image-only story`);
          }
          
          return await facebookSDK.publishStory(
            account.externalId,
            account.accessToken,
            storyToPublish
          );
        } else if (refreshedStory.mediaType === 'video') {
          console.log(`🎬 Publishing VIDEO to Facebook Story (20 seconds)...`);
          console.log(`   Video URL: ${refreshedStory.mediaUrl?.substring(0, 80)}...`);
          return await facebookSDK.publishStory(
            account.externalId,
            account.accessToken,
            { video_url: refreshedStory.mediaUrl! }
          );
        }
        throw new Error('يجب تحديد نوع الوسائط (صورة أو فيديو) للنشر كـ Story على Facebook');
      }
      
      if (format === 'reel') {
        if (!refreshedStory.mediaUrl || refreshedStory.mediaType !== 'video' || !refreshedStory.mediaUrl.startsWith('http')) {
          throw new Error('يجب إضافة رابط فيديو صالح من الإنترنت للنشر كـ Reel على Facebook');
        }
        return await facebookSDK.publishReel(
          account.externalId,
          account.accessToken,
          {
            video_url: refreshedStory.mediaUrl,
            description: refreshedStory.content,
          }
        );
      }
      
      if (facebookImageUrl && refreshedStory.mediaType && facebookImageUrl.startsWith('http')) {
        if (refreshedStory.mediaType === 'image') {
          return await facebookSDK.uploadPhoto(
            account.externalId,
            account.accessToken,
            facebookImageUrl,
            refreshedStory.content
          );
        } else if (refreshedStory.mediaType === 'video') {
          return await facebookSDK.uploadVideo(
            account.externalId,
            account.accessToken,
            refreshedStory.mediaUrl!,
            refreshedStory.content
          );
        }
      }

      return await facebookSDK.publishPost(
        account.externalId,
        account.accessToken,
        { message: refreshedStory.content }
      );
    } 
    else if (platform === 'instagram') {
      const { instagramSDK } = await import('./sdk/instagram');
      
      const instagramImageUrl = (refreshedStory as any).instagramPngUrl || refreshedStory.mediaUrl;

      if (!instagramImageUrl || !refreshedStory.mediaType || !instagramImageUrl.startsWith('http')) {
        throw new Error('يجب إضافة رابط صورة أو فيديو صالح من الإنترنت للنشر على Instagram');
      }

      if (format === 'story') {
        if (refreshedStory.mediaType === 'image') {
          console.log(`📸 Publishing to Instagram Story using ${(refreshedStory as any).instagramPngUrl ? 'platform-specific PNG' : 'default'} format`);
        } else if (refreshedStory.mediaType === 'video') {
          console.log(`🎬 Publishing VIDEO to Instagram Story...`);
          console.log(`   Video URL: ${refreshedStory.mediaUrl?.substring(0, 80)}...`);
        }
        return await instagramSDK.publishStory(
          account.externalId,
          account.accessToken,
          {
            image_url: refreshedStory.mediaType === 'image' ? instagramImageUrl : undefined,
            video_url: refreshedStory.mediaType === 'video' ? refreshedStory.mediaUrl : undefined,
            media_type: 'STORIES',
          }
        );
      }
      
      if (format === 'reel') {
        if (refreshedStory.mediaType !== 'video') {
          throw new Error('يجب أن يكون المحتوى فيديو للنشر كـ Reel على Instagram');
        }
        return await instagramSDK.publishReel(
          account.externalId,
          account.accessToken,
          refreshedStory.mediaUrl!,
          refreshedStory.content
        );
      }
      
      return await instagramSDK.publishPost(
        account.externalId,
        account.accessToken,
        {
          image_url: refreshedStory.mediaType === 'image' ? instagramImageUrl : undefined,
          video_url: refreshedStory.mediaType === 'video' ? refreshedStory.mediaUrl : undefined,
          caption: refreshedStory.content,
          media_type: refreshedStory.mediaType === 'image' ? 'IMAGE' : 'VIDEO',
        }
      );
    }
    else if (platform === 'tiktok') {
      const { tiktokSDK } = await import('./sdk/tiktok');
      
      const tiktokImageUrl = (refreshedStory as any).tiktokWebpUrl || refreshedStory.webpUrl || refreshedStory.jpegUrl || refreshedStory.mediaUrl;
      
      if (!tiktokImageUrl || !tiktokImageUrl.startsWith('http')) {
        throw new Error('يجب إضافة رابط صورة أو فيديو صالح من الإنترنت للنشر على TikTok');
      }

      if (refreshedStory.mediaType === 'image') {
        const formatUsed = (refreshedStory as any).tiktokWebpUrl ? 'platform-specific WebP' : 
                          refreshedStory.webpUrl ? 'WebP' : 
                          refreshedStory.jpegUrl ? 'JPEG' : 'PNG';
        console.log(`📸 Publishing to TikTok using ${formatUsed} format`);
        
        return await tiktokSDK.publishPhotoPost(
          account.accessToken,
          tiktokImageUrl,
          refreshedStory.content.substring(0, 150),
          refreshedStory.content.substring(0, 2200)
        );
      } else if (refreshedStory.mediaType === 'video') {
        console.log(`🎬 Publishing VIDEO to TikTok...`);
        console.log(`   Video URL: ${refreshedStory.mediaUrl?.substring(0, 80)}...`);
        return await tiktokSDK.publishVideoFromUrl(
          account.accessToken,
          refreshedStory.mediaUrl!,
          refreshedStory.content.substring(0, 150)
        );
      }
      
      throw new Error('يجب تحديد نوع الوسائط (صورة أو فيديو) للنشر على TikTok');
    }

    throw new Error(`منصة ${platform} غير مدعومة`);
  }

  stop() {
    this.isRunning = false;
    console.log('📅 Story scheduler stopped');
  }
}

export const storyScheduler = new StoryScheduler();
