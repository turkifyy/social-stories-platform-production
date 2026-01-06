import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { r2Storage } from './r2-storage';
import sharp from 'sharp';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

const TEMP_DIR = '/tmp/story-music-videos';
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

interface StoryWithMusicResult {
  url: string;
  duration: number;
  title: string;
  hasMusic: boolean;
}

export class StoryMusicService {
  private async ensureTempDir(): Promise<void> {
    try {
      if (!fs.existsSync(TEMP_DIR)) {
        await mkdirAsync(TEMP_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  // Download and trim music to 20 seconds
  private async downloadAndTrimMusic(musicUrl: string, outputPath: string): Promise<boolean> {
    try {
      console.log(`🎵 Downloading music from: ${musicUrl.substring(0, 60)}...`);
      
      const response = await fetch(musicUrl);
      if (!response.ok) {
        throw new Error(`Failed to download music: ${response.statusText}`);
      }

      const buffer = await (response as any).buffer();
      await writeFileAsync(outputPath, buffer);
      
      console.log(`🎵 Music downloaded, trimming to 20 seconds...`);
      
      const audioTrimPath = outputPath.replace('.mp3', '-trimmed.mp3');
      const trimCommand = `ffmpeg -y -i "${outputPath}" -t 20 -q:a 9 -n "${audioTrimPath}"`;
      
      try {
        await execAsync(trimCommand, {
          maxBuffer: 100 * 1024 * 1024,
          timeout: 90000
        });
        
        await unlinkAsync(outputPath).catch(() => {});
        await writeFileAsync(outputPath, await readFileAsync(audioTrimPath));
        await unlinkAsync(audioTrimPath).catch(() => {});
        
        console.log(`✅ Music trimmed to 20 seconds`);
        return true;
      } catch (error: any) {
        console.warn(`⚠️ FFmpeg trimming failed: ${error.message}, using full music file`);
        return true; // Use the full file even if trimming fails
      }
    } catch (error: any) {
      console.error(`Error downloading music: ${error.message}`);
      return false;
    }
  }

  // Find trending music (using YouTube Music Service)
  async findTrendingMusic(category: string): Promise<{ url: string; title: string; artist: string } | null> {
    try {
      console.log(`🎵 Searching for trending music for category: ${category}`);
      const { musicService } = await import('./music-service');
      const tracks = await musicService.searchMusicForCategory(category);
      
      if (tracks && tracks.length > 0) {
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        if (track.url) {
          return {
            url: track.url,
            title: track.title,
            artist: track.artist
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding trending music:', error);
      return null;
    }
  }

  async createStoryWithMusic(
    posterUrl: string,
    title: string,
    category: string,
    musicUrl?: string
  ): Promise<StoryWithMusicResult | null> {
    await this.ensureTempDir();

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const imagePath = path.join(TEMP_DIR, `poster-${timestamp}-${randomId}.png`);
    const audioPath = path.join(TEMP_DIR, `audio-${timestamp}-${randomId}.mp3`);
    const videoPath = path.join(TEMP_DIR, `video-${timestamp}-${randomId}.mp4`);

    try {
      console.log(`🖼️ Creating 20-second story video...`);
      console.log(`   Title: ${title}`);
      console.log(`   Duration: 20 seconds`);
      console.log(`   Has Music: ${!!musicUrl}`);

      // Download and process poster image
      console.log(`📥 Downloading poster image...`);
      const response = await fetch(posterUrl);
      if (!response.ok) {
        throw new Error(`Failed to download poster: ${response.statusText}`);
      }

      const imageBuffer = await (response as any).buffer();

      const processedImage = await sharp(imageBuffer)
        .resize(STORY_WIDTH, STORY_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      await writeFileAsync(imagePath, processedImage);
      console.log(`✅ Poster image processed`);

      let hasMusic = false;
      
      // Download and trim music if provided
      if (musicUrl) {
        const musicSuccess = await this.downloadAndTrimMusic(musicUrl, audioPath);
        hasMusic = musicSuccess && fs.existsSync(audioPath);
      }

      // Create video with animation and optional audio
      console.log(`🎬 Creating 20-second video with ${hasMusic ? 'music' : 'no audio'}...`);
      
      let ffmpegCommand: string;
      
      if (hasMusic) {
        // Video with music - set to 20 seconds for Facebook stories
        ffmpegCommand = `ffmpeg -y -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -c:a aac -pix_fmt yuv420p -vf "scale=1080:1920,zoompan=z='min(zoom+0.0008,1.15)':d=500:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,format=yuv420p" -shortest -t 20 -movflags +faststart "${videoPath}"`;
      } else {
        // Video without audio - 20 seconds
        ffmpegCommand = `ffmpeg -y -loop 1 -i "${imagePath}" -c:v libx264 -t 20 -pix_fmt yuv420p -vf "scale=1080:1920,zoompan=z='min(zoom+0.0008,1.15)':d=500:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,format=yuv420p" -movflags +faststart "${videoPath}"`;
      }

      await execAsync(ffmpegCommand, {
        maxBuffer: 100 * 1024 * 1024,
        timeout: 120000
      });

      console.log(`✅ 20-second video created successfully`);

      const videoBuffer = await readFileAsync(videoPath);

      const fileName = `story-videos/${category}/${timestamp}-${randomId}-story-20s.mp4`;
      const uploadedUrl = await r2Storage.uploadFile(videoBuffer, fileName, {
        contentType: 'video/mp4',
        metadata: {
          category,
          source: 'story-with-music',
          title,
          duration: '20',
          hasMusic: hasMusic.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ 20-second story video uploaded: ${uploadedUrl.substring(0, 80)}...`);

      // Cleanup temp files
      await unlinkAsync(imagePath).catch(() => {});
      await unlinkAsync(audioPath).catch(() => {});
      await unlinkAsync(videoPath).catch(() => {});

      return {
        url: uploadedUrl,
        duration: 20,
        title,
        hasMusic,
      };
    } catch (error: any) {
      console.error('Story with music creation error:', error.message);
      
      // Cleanup on error
      await unlinkAsync(imagePath).catch(() => {});
      await unlinkAsync(audioPath).catch(() => {});
      await unlinkAsync(videoPath).catch(() => {});
      
      return null;
    }
  }
}

export const storyMusicService = new StoryMusicService();
