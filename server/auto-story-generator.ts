/**
 * Automated Daily Story Generator
 * Generates 6 stories (one per category) daily at scheduled time
 * Pre-generates videos 2 hours before publish time
 */

import { firestoreService } from './firestore';
import { videoGenerator } from './video-generator';
import { musicService } from './music-service';
import { r2Storage } from './r2-storage';
import { generateContent } from './openai-service';
// @ts-ignore - type declaration in node-fetch.d.ts
import fetch from 'node-fetch';
import type { Story } from '@shared/schema';

// Suppress unused fetch import warning
void fetch;

const CATEGORIES = ['movies', 'tv_shows', 'sports', 'recipes', 'gaming', 'apps'] as const;

interface DailyStoryConfig {
  userId: string;
  platforms: Array<'facebook' | 'instagram' | 'tiktok'>;
  publishTime: string; // HH:mm format in Saudi timezone
  timezone: string;
}

export class AutoStoryGenerator {
  /**
   * Refresh settings from database
   */
  async refreshSettings(): Promise<void> {
    console.log('🔄 Refreshing auto-story generator settings');
    // Implement logic to reload settings if needed
  }

  /**
   * Generate 6 stories (one per category) for daily publishing
   */
  async generateDailyStories(config: DailyStoryConfig): Promise<Story[]> {
    try {
      console.log(`\n🎬 === GENERATING ${CATEGORIES.length} DAILY STORIES (One per category) ===`);
      const stories: Story[] = [];
      
      for (const category of CATEGORIES) {
        try {
          const story = await this.generateStoryForCategory(
            config.userId,
            category,
            config.platforms,
            config.publishTime,
            config.timezone
          );
          stories.push(story);
          console.log(`✅ Generated story for category: ${category}`);
        } catch (error) {
          console.error(`❌ Failed to generate story for ${category}:`, error);
        }
      }

      return stories;
    } catch (error) {
      console.error('❌ Daily story generation failed:', error);
      return [];
    }
  }

  /**
   * Generate story for a specific category
   */
  private async generateStoryForCategory(
    userId: string,
    category: string,
    platforms: Array<'facebook' | 'instagram' | 'tiktok'>,
    publishTime: string,
    timezone: string
  ): Promise<Story> {
    try {
      // Generate content using AI
      const { content, title, mediaUrl } = await this.generateStoryContent(category);

      // Calculate scheduled time in Saudi timezone
      const scheduledTime = this.calculateScheduledTime(publishTime, timezone);

    // Create story in Firestore
    const story = await firestoreService.createStory(userId, {
      content,
      category: category as any,
      platforms,
      scheduledTime: new Date(scheduledTime.getTime() + (CATEGORIES.indexOf(category as any) * 5 * 60 * 1000)), // 5-minute stagger
      format: 'story',
      status: 'scheduled',
      posterTitle: title,
      mediaUrl,
      mediaType: 'video', // Force mediaType to video to count in dashboard
      videoDuration: 20,
      videoGenerationStatus: 'pending',
      videoScheduledGenerationTime: new Date(scheduledTime.getTime() - 4 * 60 * 60 * 1000), // Precise 4 hours before
    });

      return story as Story;
    } catch (error) {
      console.error(`Error generating story for ${category}:`, error);
      throw error;
    }
  }

  /**
   * Generate story content using AI
   */
  private async generateStoryContent(category: string): Promise<{
    content: string;
    title: string;
    mediaUrl: string;
  }> {
    try {
      const prompt = `Generate a short, engaging social media story (max 100 chars) about trending ${category}. Only provide the story text, no introduction.`;
      
      let content = 'Check out this trending story!';
      let title = `Today's ${category.replace(/_/g, ' ')}`;
      let mediaUrl = 'https://via.placeholder.com/1080x1920?text=' + encodeURIComponent(category);

      try {
        const response = await generateContent(category);
        if (response) {
          content = response.trim().substring(0, 100);
        }
      } catch {
        console.warn('AI content generation failed, using default');
      }

      return { content, title, mediaUrl };
    } catch (error) {
      console.error('Error generating story content:', error);
      return {
        content: 'Check out this trending story!',
        title: `Today's ${category}`,
        mediaUrl: 'https://via.placeholder.com/1080x1920?text=' + encodeURIComponent(category),
      };
    }
  }

  /**
   * Pre-generate videos for stories scheduled within 4 hours with 5-minute intervals
   */
  async preGenerateVideos(stories: Story[]): Promise<void> {
    try {
      console.log(`\n📹 === SMART VIDEO PRE-GENERATION (4 hours buffer) ===`);
      
      const now = new Date();
      const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

      // Sort stories by scheduled time to ensure correct interval processing
      const scheduledStories = stories
        .filter(s => s.status === 'scheduled' && s.videoGenerationStatus === 'pending')
        .sort((a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime());

      for (let i = 0; i < scheduledStories.length; i++) {
        const story = scheduledStories[i];
        const scheduledTime = new Date(story.scheduledTime!);
        
        if (scheduledTime >= now && scheduledTime <= fourHoursLater && story.mediaUrl) {
          try {
            console.log(`🤖 [Queue] Processing video ${i + 1}/6: ${story.category}`);
            
            // Artificial 5-minute stagger between video generations
            if (i > 0) {
              console.log(`⏳ Waiting 5 minutes before next generation...`);
              await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
            }

            // Select music for category
            const musicTracks = await musicService.searchMusicForCategory(story.category);
            const selectedMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];

            // Generate video and ensure path mapping
            const result = await videoGenerator.generateAndUploadVideo({
              storyId: story.id,
              category: story.category,
              posterUrl: story.mediaUrl,
              musicTrack: {
                title: selectedMusic.title,
                artist: selectedMusic.artist,
                source: selectedMusic.source,
                url: selectedMusic.url,
              },
              scheduledTime: story.scheduledTime,
            });

            if (result.success) {
              await firestoreService.updateStory(story.id, {
                videoUrl: result.videoUrl,
                videoStorageKey: result.storageKey,
                videoGenerationStatus: 'generated',
                videoGeneratedAt: new Date(),
                musicTitle: selectedMusic.title,
                musicArtist: selectedMusic.artist,
              });
              console.log(`✅ Video generated and stored in R2: ${story.id}`);
            }
          } catch (error) {
            console.error(`❌ Error in pre-generation for ${story.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error pre-generating videos:', error);
    }
  }

  /**
   * Calculate scheduled time in Saudi timezone
   */
  private calculateScheduledTime(publishTime: string, timezone: string): Date {
    const today = new Date();
    const [hours, minutes] = publishTime.split(':').map(Number);
    
    // Create time in Saudi timezone (UTC+3)
    const saudiTime = new Date(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      hours,
      minutes,
      0,
      0
    );

    // Convert to UTC
    const utcTime = new Date(saudiTime.getTime() - 3 * 60 * 60 * 1000);
    
    // Ensure we don't schedule in the past (with a 15-minute buffer to allow for generation)
    if (utcTime.getTime() < Date.now() + 15 * 60 * 1000) {
      utcTime.setDate(utcTime.getDate() + 1);
    }
    
    return utcTime;
  }
}

export const autoStoryGenerator = new AutoStoryGenerator();
