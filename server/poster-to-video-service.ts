import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { r2Storage } from './r2-storage';
import sharp from 'sharp';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

const TEMP_DIR = '/tmp/poster-videos';
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

interface PosterVideoResult {
  url: string;
  duration: number;
  title: string;
  source: 'poster-video';
}

export class PosterToVideoService {
  private async ensureTempDir(): Promise<void> {
    try {
      if (!fs.existsSync(TEMP_DIR)) {
        await mkdirAsync(TEMP_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async createVideoFromPoster(
    posterUrl: string,
    title: string,
    category: string,
    duration: number = 20
  ): Promise<PosterVideoResult | null> {
    await this.ensureTempDir();

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const imagePath = path.join(TEMP_DIR, `poster-${timestamp}-${randomId}.png`);
    const videoPath = path.join(TEMP_DIR, `video-${timestamp}-${randomId}.mp4`);

    try {
      console.log(`🖼️ Creating video from poster image...`);
      console.log(`   Title: ${title}`);
      console.log(`   Duration: ${duration}s`);

      // Try to get background music
      let audioPath = path.join(TEMP_DIR, `audio-${timestamp}-${randomId}.mp3`);
      let hasAudio = false;
      try {
        const { musicService } = await import('./music-service');
        const tracks = await musicService.searchMusicForCategory(category);
        if (tracks && tracks.length > 0) {
          // Select a random track from results for variety
          const track = tracks[Math.floor(Math.random() * tracks.length)];
          console.log(`🎵 Selected background music: ${track.title}`);
          await musicService.downloadMusic(track, audioPath);
          if (fs.existsSync(audioPath)) {
            hasAudio = true;
          }
        }
      } catch (e) {
        console.warn('Could not add music to poster video:', e);
      }

      console.log(`📥 Downloading poster image from: ${posterUrl.substring(0, 60)}...`);
      const response = await fetch(posterUrl);
      if (!response.ok) {
        throw new Error(`Failed to download poster: ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      const processedImage = await sharp(imageBuffer)
        .resize(STORY_WIDTH, STORY_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      await writeFileAsync(imagePath, processedImage);
      console.log(`✅ Poster image processed and saved`);

      console.log(`🎬 Creating video with zoom animation and ${hasAudio ? 'music' : 'silence'}...`);
      
      let command: string;
      if (hasAudio) {
        // Updated FFmpeg command to ensure audio is mixed correctly and doesn't exceed video duration
        command = `ffmpeg -y -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -c:a aac -b:a 192k -t ${duration} -pix_fmt yuv420p -vf "scale=1080:1920,zoompan=z='min(zoom+0.001,1.2)':d=${duration * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,format=yuv420p" -shortest -movflags +faststart "${videoPath}"`;
      } else {
        command = `ffmpeg -y -loop 1 -i "${imagePath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=1080:1920,zoompan=z='min(zoom+0.001,1.2)':d=${duration * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,format=yuv420p" -movflags +faststart "${videoPath}"`;
      }

      await execAsync(command, {
        maxBuffer: 100 * 1024 * 1024,
        timeout: 120000
      });

      console.log(`✅ Video created successfully`);

      const videoBuffer = await readFileAsync(videoPath);

      const fileName = `trending-videos/${category}/${timestamp}-${randomId}-poster-video.mp4`;
      const uploadedUrl = await r2Storage.uploadFile(videoBuffer, fileName, {
        contentType: 'video/mp4',
        metadata: {
          category,
          source: 'poster-video',
          title,
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ Poster video uploaded to R2: ${uploadedUrl.substring(0, 80)}...`);

      await unlinkAsync(imagePath).catch(() => {});
      await unlinkAsync(videoPath).catch(() => {});
      if (hasAudio) await unlinkAsync(audioPath).catch(() => {});

      return {
        url: uploadedUrl,
        duration,
        title,
        source: 'poster-video',
      };
    } catch (error: any) {
      console.error('Poster to video conversion error:', error.message);
      
      await unlinkAsync(imagePath).catch(() => {});
      await unlinkAsync(videoPath).catch(() => {});
      
      return null;
    }
  }

  async createVideoFromPosterWithText(
    posterUrl: string,
    title: string,
    category: string,
    overlayText: string,
    duration: number = 20
  ): Promise<PosterVideoResult | null> {
    await this.ensureTempDir();

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const imagePath = path.join(TEMP_DIR, `poster-${timestamp}-${randomId}.png`);
    const videoPath = path.join(TEMP_DIR, `video-${timestamp}-${randomId}.mp4`);

    try {
      console.log(`🖼️ Creating video from poster with text overlay...`);

      const response = await fetch(posterUrl);
      if (!response.ok) {
        throw new Error(`Failed to download poster: ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      const gradientHeight = 600;
      const svgOverlay = `
        <svg width="${STORY_WIDTH}" height="${STORY_HEIGHT}">
          <defs>
            <linearGradient id="bottomGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
              <stop offset="50%" style="stop-color:rgba(0,0,0,0.7);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgba(0,0,0,0.95);stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect x="0" y="${STORY_HEIGHT - gradientHeight}" width="${STORY_WIDTH}" height="${gradientHeight}" fill="url(#bottomGradient)" />
          <text x="${STORY_WIDTH / 2}" y="${STORY_HEIGHT - 200}" 
                text-anchor="middle" 
                font-family="Arial, sans-serif" 
                font-size="48" 
                font-weight="bold" 
                fill="white"
                filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.8))">
            ${this.escapeXml(title.length > 25 ? title.substring(0, 25) + '...' : title)}
          </text>
          <text x="${STORY_WIDTH / 2}" y="${STORY_HEIGHT - 120}" 
                text-anchor="middle" 
                font-family="Arial, sans-serif" 
                font-size="32" 
                fill="#FFD700">
            ${this.escapeXml(overlayText)}
          </text>
        </svg>
      `;

      const overlayBuffer = Buffer.from(svgOverlay);

      const processedImage = await sharp(imageBuffer)
        .resize(STORY_WIDTH, STORY_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .composite([{
          input: overlayBuffer,
          top: 0,
          left: 0,
        }])
        .png()
        .toBuffer();

      await writeFileAsync(imagePath, processedImage);

      const command = `ffmpeg -y -loop 1 -i "${imagePath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=1080:1920,zoompan=z='min(zoom+0.0008,1.15)':d=${duration * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920,format=yuv420p" -movflags +faststart "${videoPath}"`;

      await execAsync(command, {
        maxBuffer: 100 * 1024 * 1024,
        timeout: 120000
      });

      const videoBuffer = await readFileAsync(videoPath);

      const fileName = `trending-videos/${category}/${timestamp}-${randomId}-poster-video.mp4`;
      const uploadedUrl = await r2Storage.uploadFile(videoBuffer, fileName, {
        contentType: 'video/mp4',
        metadata: {
          category,
          source: 'poster-video-text',
          title,
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ Poster video with text uploaded: ${uploadedUrl.substring(0, 80)}...`);

      await unlinkAsync(imagePath).catch(() => {});
      await unlinkAsync(videoPath).catch(() => {});

      return {
        url: uploadedUrl,
        duration,
        title,
        source: 'poster-video',
      };
    } catch (error: any) {
      console.error('Poster to video with text error:', error.message);
      
      await unlinkAsync(imagePath).catch(() => {});
      await unlinkAsync(videoPath).catch(() => {});
      
      return null;
    }
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const posterToVideoService = new PosterToVideoService();
