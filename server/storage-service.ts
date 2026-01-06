import * as fs from 'fs';
import * as path from 'path';
import { r2Storage } from './r2-storage';

interface VideoStorageMetadata {
  storyId: string;
  category: string;
  contentType?: string;
  fileSize: number;
  duration: number;
  generatedAt: Date;
  uploadedAt?: Date;
}

interface StorageResult {
  success: boolean;
  videoUrl?: string;
  storageKey?: string;
  fileSize?: number;
  error?: string;
}

export class StorageService {
  private basePath: string = 'videos';
  private archivePath: string = 'videos/archive';
  private tempPath: string = '/tmp/video-storage';

  constructor() {
    this.ensureTempDirectory();
  }

  private ensureTempDirectory() {
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  /**
   * Upload video to R2 storage
   */
  async uploadVideo(
    videoPath: string,
    storyId: string,
    category: string,
    duration: number = 20
  ): Promise<StorageResult> {
    try {
      // Verify file exists and is readable
      if (!fs.existsSync(videoPath)) {
        return {
          success: false,
          error: `Video file not found: ${videoPath}`,
        };
      }

      const fileStats = fs.statSync(videoPath);
      const fileSize = fileStats.size;

      console.log(`📤 Uploading video: ${storyId} (${fileSize} bytes)`);

      // Read video file
      const videoBuffer = fs.readFileSync(videoPath);

      // Create storage key with timestamp and category
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const storageKey = `${this.basePath}/${category}/${storyId}_${timestamp}.mp4`;

      // Prepare metadata
      const metadata: Record<string, string> = {
        'story-id': storyId,
        'category': category,
        'duration': duration.toString(),
        'generated-at': new Date().toISOString(),
      };

      // Upload to R2
      const videoUrl = await r2Storage.uploadFile(videoBuffer, storageKey, {
        contentType: 'video/mp4',
        metadata,
        cacheControl: 'public, max-age=31536000',
      });

      console.log(`✅ Video uploaded: ${storageKey}`);

      return {
        success: true,
        videoUrl,
        storageKey,
        fileSize,
      };
    } catch (error) {
      console.error(`❌ Video upload failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Get video URL from storage
   */
  async getVideoUrl(storageKey: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const url = await r2Storage.getFileUrl(storageKey, expiresIn);
      return url;
    } catch (error) {
      console.error(`❌ Failed to get video URL: ${error}`);
      return null;
    }
  }

  /**
   * Delete video from storage
   */
  async deleteVideo(storageKey: string): Promise<boolean> {
    try {
      await r2Storage.deleteFile(storageKey);
      console.log(`🗑️ Video deleted: ${storageKey}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete video: ${error}`);
      return false;
    }
  }

  /**
   * Archive old videos (move to archive path)
   */
  async archiveOldVideos(olderThanDays: number = 30): Promise<number> {
    try {
      console.log(`📦 Archiving videos older than ${olderThanDays} days...`);

      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - olderThanDays);

      const listResult = await r2Storage.listFiles(this.basePath);
      let archivedCount = 0;

      for (const obj of listResult.objects) {
        if (
          obj.lastModified &&
          obj.lastModified < cutoffTime &&
          !obj.key.includes('/archive/')
        ) {
          const archiveKey = obj.key.replace(this.basePath, this.archivePath);
          
          try {
            // Copy to archive
            const videoBuffer = await r2Storage.getFile(obj.key);
            await r2Storage.uploadFile(videoBuffer, archiveKey, {
              contentType: 'video/mp4',
              cacheControl: 'public, max-age=31536000',
            });

            // Delete original
            await r2Storage.deleteFile(obj.key);
            archivedCount++;
            console.log(`  📁 Archived: ${obj.key}`);
          } catch (error) {
            console.warn(`  ⚠️ Failed to archive ${obj.key}: ${error}`);
          }
        }
      }

      console.log(`✅ Archived ${archivedCount} videos`);
      return archivedCount;
    } catch (error) {
      console.error(`❌ Archival process failed: ${error}`);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalVideos: number;
    totalSize: number;
    videosByCategory: Record<string, number>;
  }> {
    try {
      const result = await r2Storage.listFiles(this.basePath, 10000);

      const stats = {
        totalVideos: 0,
        totalSize: 0,
        videosByCategory: {} as Record<string, number>,
      };

      for (const obj of result.objects) {
        stats.totalVideos++;
        stats.totalSize += obj.size || 0;

        // Extract category from path (videos/{category}/{id})
        const parts = obj.key.split('/');
        if (parts.length >= 3) {
          const category = parts[1];
          stats.videosByCategory[category] = (stats.videosByCategory[category] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error(`❌ Failed to get storage stats: ${error}`);
      return {
        totalVideos: 0,
        totalSize: 0,
        videosByCategory: {},
      };
    }
  }

  /**
   * Clean up local temporary video files
   */
  async cleanupLocalTempFiles(): Promise<number> {
    try {
      let cleanedCount = 0;

      if (fs.existsSync(this.tempPath)) {
        const files = fs.readdirSync(this.tempPath);

        for (const file of files) {
          const filePath = path.join(this.tempPath, file);

          // Delete files older than 24 hours
          const stats = fs.statSync(filePath);
          const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

          if (ageHours > 24) {
            fs.unlinkSync(filePath);
            cleanedCount++;
            console.log(`  🗑️ Deleted: ${file}`);
          }
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} temporary files`);
      return cleanedCount;
    } catch (error) {
      console.error(`⚠️ Failed to cleanup temporary files: ${error}`);
      return 0;
    }
  }

  /**
   * Get list of videos for a category
   */
  async getVideosByCategory(category: string): Promise<Array<{
    key: string;
    size: number;
    lastModified?: Date;
  }>> {
    try {
      const prefix = `${this.basePath}/${category}`;
      const result = await r2Storage.listFiles(prefix, 1000);
      return result.objects;
    } catch (error) {
      console.error(`❌ Failed to get videos for category: ${error}`);
      return [];
    }
  }

  /**
   * Get recent videos
   */
  async getRecentVideos(limit: number = 20): Promise<Array<{
    key: string;
    size: number;
    lastModified?: Date;
    category?: string;
  }>> {
    try {
      const result = await r2Storage.listFiles(this.basePath, limit);

      return result.objects
        .sort((a, b) => {
          const aTime = a.lastModified?.getTime() || 0;
          const bTime = b.lastModified?.getTime() || 0;
          return bTime - aTime;
        })
        .slice(0, limit)
        .map(obj => {
          const parts = obj.key.split('/');
          return {
            ...obj,
            category: parts[1] || 'unknown',
          };
        });
    } catch (error) {
      console.error(`❌ Failed to get recent videos: ${error}`);
      return [];
    }
  }

  /**
   * Verify video storage health
   */
  async verifyStorageHealth(): Promise<{
    healthy: boolean;
    message: string;
    stats?: {
      totalVideos: number;
      totalSize: number;
    };
  }> {
    try {
      const stats = await this.getStorageStats();

      return {
        healthy: true,
        message: `Storage healthy: ${stats.totalVideos} videos, ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
        stats,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Storage check failed: ${error}`,
      };
    }
  }

  /**
   * Get storage path for temporary files
   */
  getTempPath(): string {
    return this.tempPath;
  }

  /**
   * Clear all temporary files (use with caution)
   */
  async clearTempDirectory(): Promise<void> {
    try {
      if (fs.existsSync(this.tempPath)) {
        const files = fs.readdirSync(this.tempPath);
        for (const file of files) {
          const filePath = path.join(this.tempPath, file);
          fs.unlinkSync(filePath);
        }
      }
      console.log('✅ Temporary directory cleared');
    } catch (error) {
      console.error(`⚠️ Failed to clear temp directory: ${error}`);
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
