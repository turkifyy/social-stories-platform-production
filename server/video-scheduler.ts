import { firestoreService } from "./firestore";
import { videoGenerator } from "./video-generator";
import type { Story } from "@shared/schema";

export class VideoScheduler {
  private scheduledVideoJobs: Map<string, NodeJS.Timeout> = new Map();
  private processingStoryIds: Set<string> = new Set();

  /**
   * Schedule a video to be generated before its scheduled publish time
   */
  async scheduleVideoGeneration(
    story: Story,
    hoursBefore: number = 4
  ): Promise<boolean> {
    try {
      if (!story.id) {
        console.error('Cannot schedule video for story without ID');
        return false;
      }

      // تحسين الموثوقية: التحقق من وجود رابط الوسائط الأساسي
      if (!story.mediaUrl) {
        console.error(`❌ لا يمكن جدولة الفيديو للقصة ${story.id} لعدم وجود رابط وسائط`);
        await firestoreService.updateStory(story.id, { videoGenerationStatus: 'error' });
        return false;
      }

      // Check if video is already being generated or is already generated
      if (story.videoGenerationStatus === 'generating' || story.videoGenerationStatus === 'generated' || this.processingStoryIds.has(story.id)) {
        console.log(`ℹ️ Video already in status ${story.videoGenerationStatus} or processing for story ${story.id}`);
        return true;
      }

      const publishTime = new Date(story.scheduledTime);
      const generationTime = new Date(publishTime.getTime() - hoursBefore * 60 * 60 * 1000);
      const now = new Date();

      if (generationTime <= now) {
        // If the time has already passed or is too close, generate immediately
        console.log(`⏰ Generation time already passed or imminent for story ${story.id}, generating immediately`);
        // We run it as a floating promise to avoid blocking the main thread
        this.generateVideoNow(story.id).catch(err => console.error(`Failed generation for ${story.id}:`, err));
        return true;
      }

      const delayMs = generationTime.getTime() - now.getTime();
      const jobId = `video-gen-${story.id}`;

      // Clear any existing scheduled job
      if (this.scheduledVideoJobs.has(jobId)) {
        clearTimeout(this.scheduledVideoJobs.get(jobId)!);
      }

      // Schedule the video generation
      const timeout = setTimeout(async () => {
        console.log(`🎬 Starting scheduled video generation for story ${story.id}`);
        await this.generateVideoNow(story.id);
        this.scheduledVideoJobs.delete(jobId);
      }, delayMs);

      this.scheduledVideoJobs.set(jobId, timeout);

      console.log(`⏰ Video generation scheduled for story ${story.id} in ${hoursBefore} hours`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error scheduling video generation:`, error);
      return false;
    }
  }

  /**
   * Generate video for a story immediately
   */
  private async generateVideoNow(storyId: string): Promise<void> {
    if (this.processingStoryIds.has(storyId)) return;
    this.processingStoryIds.add(storyId);
    
    try {
      const story = await firestoreService.getStoryById(storyId);
      
      if (!story) {
        console.error(`Story ${storyId} not found`);
        return;
      }

      // Update status to generating
      await firestoreService.updateStory(storyId, {
        videoGenerationStatus: 'generating',
        videoGeneratedAt: new Date(),
      });

      console.log(`🎬 Starting video generation for story ${storyId}`);

      // Generate the video
      const videoResult = await videoGenerator.generateAndUploadVideo({
        storyId: story.id,
        category: story.category,
        posterUrl: story.mediaUrl!,
        scheduledTime: story.scheduledTime,
      });

      if (videoResult.success && videoResult.videoUrl) {
        // Update story with video URL
        await firestoreService.updateStory(storyId, {
          videoUrl: videoResult.videoUrl,
          videoGenerationStatus: 'generated',
          videoStorageKey: videoResult.storageKey,
        });

        console.log(`✅ Video generated successfully for story ${storyId}`);
      } else {
        // Mark as error
        await firestoreService.updateStory(storyId, {
          videoGenerationStatus: 'error',
        });

        console.error(`❌ Video generation failed for story ${storyId}: ${videoResult.error}`);
      }
    } catch (error: any) {
      console.error(`❌ Error in generateVideoNow:`, error);
      
      try {
        await firestoreService.updateStory(storyId, {
          videoGenerationStatus: 'error',
        });
      } catch (updateError) {
        console.error(`Failed to update story status:`, updateError);
      }
    } finally {
      this.processingStoryIds.delete(storyId);
    }
  }

  /**
   * Get all scheduled video jobs
   */
  getScheduledJobs(): Array<{ jobId: string; storyId: string }> {
    const jobIds: string[] = [];
    this.scheduledVideoJobs.forEach((_, jobId) => {
      jobIds.push(jobId);
    });
    return jobIds.map((jobId) => ({
      jobId,
      storyId: jobId.replace('video-gen-', ''),
    }));
  }

  /**
   * Cancel a scheduled video generation
   */
  cancelScheduledJob(storyId: string): boolean {
    const jobId = `video-gen-${storyId}`;
    const timeout = this.scheduledVideoJobs.get(jobId);
    
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledVideoJobs.delete(jobId);
      console.log(`❌ Cancelled scheduled video generation for story ${storyId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Clear all scheduled jobs
   */
  clearAllJobs(): number {
    const count = this.scheduledVideoJobs.size;
    const timeouts: NodeJS.Timeout[] = [];
    
    this.scheduledVideoJobs.forEach((timeout) => {
      timeouts.push(timeout);
    });
    
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    
    this.scheduledVideoJobs.clear();
    console.log(`🗑️ Cleared ${count} scheduled video generation jobs`);
    return count;
  }
}

export const videoScheduler = new VideoScheduler();
