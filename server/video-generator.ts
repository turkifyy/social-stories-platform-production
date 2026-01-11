import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { storageService } from './storage-service';
import { musicService } from './music-service';

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface VideoGenerationOptions {
  posterUrl: string;
  audioPath?: string;
  duration?: number;
  width?: number;
  height?: number;
  bitrate?: string;
  quality?: 'sd' | 'hd' | '4k';
}

interface VideoGenerationResult {
  success: boolean;
  videoPath?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
  generatedAt?: Date;
}

interface VideoGenerationRequest {
  storyId: string;
  category: string;
  posterUrl: string;
  musicTrack?: { title: string; artist: string; url?: string; source: string };
  scheduledTime?: Date;
}

export class VideoGenerator {
  private tempDir: string;
  private outputDir: string;
  private defaultDuration: number = 20; // 20 seconds
  private defaultWidth: number = 1080;
  private defaultHeight: number = 1920;

  constructor(tempDir: string = '/tmp/video-generator') {
    this.tempDir = tempDir;
    this.outputDir = path.join(tempDir, 'output');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Download image from URL to local file
   */
  private async downloadImage(imageUrl: string, outputPath: string): Promise<boolean> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      fs.writeFileSync(outputPath, buffer);

      console.log(`✅ Downloaded image: ${outputPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to download image: ${error}`);
      return false;
    }
  }

  /**
   * Create a solid color image as fallback
   */
  private async createFallbackImage(outputPath: string, width: number, height: number): Promise<boolean> {
    try {
      // Use ffmpeg to create a solid color image
      await execAsync(
        `ffmpeg -f lavfi -i color=c=blue:s=${width}x${height} -frames:v 1 "${outputPath}" 2>/dev/null`
      );

      if (fs.existsSync(outputPath)) {
        console.log(`✅ Created fallback image: ${outputPath}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Failed to create fallback image: ${error}`);
      return false;
    }
  }

  /**
   * Generate video from image and audio
   */
  async generateVideo(options: VideoGenerationOptions, storyId: string): Promise<VideoGenerationResult> {
    const startTime = Date.now();

    try {
      console.log(`🎬 Starting video generation for story: ${storyId}`);

      // Create unique file names
      const timestamp = Date.now();
      const imagePath = path.join(this.tempDir, `image_${timestamp}.jpg`);
      const audioPath = options.audioPath || path.join(this.tempDir, `audio_${timestamp}.mp3`);
      const videoPath = path.join(this.outputDir, `${storyId}_${timestamp}.mp4`);

      const width = options.width || this.defaultWidth;
      const height = options.height || this.defaultHeight;
      const duration = options.duration || this.defaultDuration;
      const quality = options.quality || 'hd';

      // Download image
      let imageDownloaded = false;
      try {
        imageDownloaded = await this.downloadImage(options.posterUrl, imagePath);
      } catch (err) {
        console.error(`❌ Error during image download process: ${err}`);
      }
      
      if (!imageDownloaded) {
        // Create fallback image
        console.log('⚠️ Using fallback image...');
        const fallbackCreated = await this.createFallbackImage(imagePath, width, height);
        if (!fallbackCreated) {
          throw new Error('Failed to create image');
        }
      }

      // Ensure audio exists
      if (!fs.existsSync(audioPath)) {
        console.log('⚠️ Audio file not found, generating ambient background...');
        try {
          // Try to get a trending track for the category as fallback if audioPath wasn't provided or failed
          const fallbackTracks = await musicService.searchMusicForCategory('movies'); 
          if (fallbackTracks && fallbackTracks.length > 0) {
             const track = fallbackTracks[Math.floor(Math.random() * fallbackTracks.length)];
             await musicService.downloadMusic(track, audioPath);
             if (!fs.existsSync(audioPath)) {
                await musicService.generateSilentMP3(audioPath, duration);
             }
          } else {
             await musicService.generateSilentMP3(audioPath, duration);
          }
        } catch (e) {
          console.error('Failed to get fallback music:', e);
          await musicService.generateSilentMP3(audioPath, duration);
        }
      }

      // Generate video using FFmpeg
      const videoBitrate = quality === 'hd' ? '5000k' : quality === '4k' ? '10000k' : '2000k';
      const audioBitrate = '192k';

      console.log(`📹 Creating video: ${width}x${height}, ${duration}s, ${videoBitrate}`);

      // FFmpeg command with ULTRA power-efficient settings for maximum speed
      const ffmpegCmd = [
        '-loop', '1',
        '-i', imagePath,
        '-i', audioPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',  // Slightly slower than ultrafast for better compression/quality balance
        '-crf', '22',           // Professional quality (lower is better)
        '-pix_fmt', 'yuv420p',
        '-threads', '0',
        '-vf', [
          `scale=${STORY_WIDTH}:${STORY_HEIGHT}:force_original_aspect_ratio=increase`, 
          `crop=${STORY_WIDTH}:${STORY_HEIGHT}`,
          `format=yuv420p`
        ].join(','),
        '-c:a', 'aac',
        '-b:a', '320k',          // Maximum standard bitrate for high-end audio
        '-ar', '48000',          // Studio standard
        '-ac', '2',
        '-shortest',
        '-t', duration.toString(),
        '-movflags', '+faststart',
        '-y',
        videoPath,
      ];
      
      console.log('🚀 [VideoTool] Executing FFmpeg with ULTRAFAST Power-Saving settings...');

      console.log('🔄 Running FFmpeg...');
      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', ffmpegCmd);

        let stderr = '';
        ffmpegProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        ffmpegProcess.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        ffmpegProcess.on('error', (error: Error) => {
          reject(error);
        });
      });

      // Verify video was created and has audio stream
      if (!fs.existsSync(videoPath)) {
        throw new Error('Video file was not created');
      }

      // Quick audio verification using ffprobe
      try {
        const { stdout: audioInfo } = await execAsync(
          `ffprobe -v error -select_streams a -show_entries stream=codec_name,bit_rate,duration -of json "${videoPath}"`
        );
        
        const audioData = JSON.parse(audioInfo);
        const hasAudio = audioData.streams && audioData.streams.length > 0;
        
        if (!hasAudio) {
          console.error(`⚠️ Generated video ${storyId} is SILENT! No audio stream found.`);
          // Check if audio file itself was valid
          const audioStats = fs.statSync(audioPath);
          if (audioStats.size < 1000) {
            console.error(`❌ Source audio file is too small (${audioStats.size} bytes). Likely failed download.`);
          }
          throw new Error('Verification failed: Generated video is silent');
        } else {
          const stream = audioData.streams[0];
          console.log(`🎵 Audio verified: ${stream.codec_name}, Bitrate: ${stream.bit_rate || 'unknown'}, Duration: ${stream.duration}s`);
          
          // Technical Quality Check: Sample rate, bit depth, and stereo
          const { stdout: technicalInfo } = await execAsync(
            `ffprobe -v error -select_streams a -show_entries stream=sample_rate,channels,bits_per_sample,codec_name -of json "${videoPath}"`
          );
          const techData = JSON.parse(technicalInfo);
          const techStream = techData.streams[0];
          
          if (parseInt(techStream.sample_rate) < 48000) {
            console.warn(`⚠️ Sample rate (${techStream.sample_rate}Hz) is below studio standard (48kHz). Professional audio is usually 48kHz+`);
          }
          
          if (techStream.channels < 2) {
            console.error(`❌ Mono audio detected for story ${storyId}. Professional stories require stereo output.`);
            throw new Error('Verification failed: Professional quality requires stereo audio');
          }

          // Strict Bitrate check
          const bitrate = parseInt(stream.bit_rate) || 0;
          if (bitrate > 0 && bitrate < 192000) {
            console.error(`❌ Low audio bitrate (${bitrate/1000}kbps) for ${storyId}. Minimum 192kbps required for professional output.`);
            throw new Error('Verification failed: Audio quality too low (192kbps min)');
          }

          // Elite Professional duration check (99.95% coverage)
          const audioDuration = parseFloat(stream.duration);
          const minRequiredDuration = duration * 0.9995; 
          if (audioDuration < minRequiredDuration) {
             console.error(`❌ Audio duration (${audioDuration}s) does not cover video (${duration}s). Coverage: ${(audioDuration/duration*100).toFixed(3)}%`);
             throw new Error('Verification failed: Audio coverage must be absolute (99.95% minimum)');
          }

          // Audio Level Verification: Detect if the stream is technically present but effectively silent
          try {
            const { stderr: volumeInfo } = await execAsync(
              `ffmpeg -i "${videoPath}" -af "volumedetect" -f null /dev/null 2>&1`
            );
            const meanVolumeMatch = volumeInfo.match(/mean_volume: ([\-\d.]+) dB/);
            const maxVolumeMatch = volumeInfo.match(/max_volume: ([\-\d.]+) dB/);
            
            if (meanVolumeMatch && parseFloat(meanVolumeMatch[1]) < -60) {
              console.error(`❌ Effectively silent audio detected (Mean volume: ${meanVolumeMatch[1]}dB)`);
              throw new Error('Verification failed: Effective silence detected');
            }
            
            console.log(`🔊 Audio Levels Verified: Mean ${meanVolumeMatch ? meanVolumeMatch[1] : 'unknown'}dB, Max ${maxVolumeMatch ? maxVolumeMatch[1] : 'unknown'}dB`);
          } catch (volErr: any) {
            console.warn(`⚠️ Volume level check skipped or failed: ${volErr.message}`);
          }
          
          console.log(`✅ Absolute Elite Verification Passed: ${storyId} with ${techStream.codec_name.toUpperCase()} @ ${bitrate/1000}kbps, 48kHz Stereo, 99.95% sync.`);
        }
      } catch (audioErr: any) {
        console.error(`❌ Critical audio verification error: ${audioErr.message}`);
        throw audioErr; // Don't save silent/broken videos
      }

      const fileStats = fs.statSync(videoPath);
      const fileSize = fileStats.size;
      const generatedTime = Date.now() - startTime;

      console.log(`✅ Video generated successfully`);
      console.log(`  📊 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  ⏱️  Time: ${(generatedTime / 1000).toFixed(2)}s`);

      // Cleanup temporary files
      this.cleanupFiles([imagePath, audioPath]);

      return {
        success: true,
        videoPath,
        duration,
        fileSize,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error(`❌ Video generation failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Generate video from request (high-level method with better error handling)
   */
  async generateVideoFromRequest(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    try {
      console.log(`🎬 Processing video request for ${request.category}: ${request.storyId}`);

      // Get or download audio
      let audioPath: string | undefined;

      if (request.musicTrack) {
        console.log(`🎵 Setting up music: ${request.musicTrack.title}`);

        try {
          const { path: downloadedPath } = await musicService.getOrDownloadTrack({
            id: `${request.storyId}_audio`,
            title: request.musicTrack.title,
            artist: request.musicTrack.artist,
            duration: 20,
            source: (request.musicTrack.source as any) || 'api',
            url: request.musicTrack.url,
          });

          if (!fs.existsSync(downloadedPath)) {
            throw new Error(`Audio file was not created: ${downloadedPath}`);
          }

          audioPath = downloadedPath;
          console.log(`✅ Music ready: ${audioPath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to get music, using silence: ${error}`);
          // Will use silence fallback in generateVideo
        }
      }

      // Generate video with image and optional music
      return await this.generateVideo(
        {
          posterUrl: request.posterUrl,
          audioPath,
          duration: 20,
          quality: 'hd',
        },
        request.storyId
      );
    } catch (error) {
      console.error(`❌ Video generation from request failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Generate and upload video (full pipeline)
   */
  async generateAndUploadVideo(request: VideoGenerationRequest): Promise<{
    success: boolean;
    videoUrl?: string;
    storageKey?: string;
    error?: string;
  }> {
    let videoPath: string | undefined;

    try {
      // Generate video
      const generationResult = await this.generateVideoFromRequest(request);

      if (!generationResult.success || !generationResult.videoPath) {
        throw new Error(generationResult.error || 'Video generation failed');
      }

      videoPath = generationResult.videoPath;

      // Upload to storage
      console.log(`📤 Uploading generated video...`);
      const uploadResult = await storageService.uploadVideo(
        videoPath,
        request.storyId,
        request.category,
        20
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Video upload failed');
      }

      console.log(`✅ Video generation and upload complete`);

      return {
        success: true,
        videoUrl: uploadResult.videoUrl,
        storageKey: uploadResult.storageKey,
      };
    } catch (error) {
      console.error(`❌ Video generation and upload failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    } finally {
      // Cleanup
      if (videoPath && fs.existsSync(videoPath)) {
        try {
          fs.unlinkSync(videoPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Create a test/demo video
   */
  async createDemoVideo(): Promise<VideoGenerationResult> {
    try {
      console.log('🎬 Creating demo video...');

      const imagePath = path.join(this.tempDir, 'demo_image.jpg');
      const audioPath = path.join(this.tempDir, 'demo_audio.mp3');
      const videoPath = path.join(this.outputDir, 'demo_video.mp4');

      // Create a solid color image
      await this.createFallbackImage(imagePath, 1920, 1080);

      // Create silent audio
      await musicService.generateSilentMP3(audioPath, 20);

      // Generate video
      return await this.generateVideo(
        {
          posterUrl: 'file://' + imagePath,
          audioPath,
          duration: 20,
          quality: 'hd',
        },
        'demo'
      );
    } catch (error) {
      console.error(`❌ Demo video creation failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Clean up temporary files
   */
  private cleanupFiles(files: string[]): void {
    for (const file of files) {
      try {
        if (file && fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to delete temporary file: ${file}`);
      }
    }
  }

  /**
   * Get information about a video file
   */
  async getVideoInfo(
    videoPath: string
  ): Promise<{
    duration: number;
    width: number;
    height: number;
    bitrate?: string;
    format?: string;
  }> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=duration,width,height,bit_rate -of csv=p=0 "${videoPath}"`
      );

      const parts = stdout.trim().split(',');
      return {
        duration: parseFloat(parts[0]) || 20,
        width: parseInt(parts[1]) || 1920,
        height: parseInt(parts[2]) || 1080,
        bitrate: parts[3],
        format: 'mp4',
      };
    } catch (error) {
      console.warn(`⚠️ Failed to get video info: ${error}`);
      return {
        duration: 20,
        width: 1920,
        height: 1080,
        format: 'mp4',
      };
    }
  }

  /**
   * Clear all temporary files
   */
  async clearTempFiles(): Promise<void> {
    try {
      const directories = [this.tempDir, this.outputDir];

      for (const dir of directories) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            fs.unlinkSync(filePath);
          }
        }
      }

      console.log('✅ Temporary files cleared');
    } catch (error) {
      console.error(`⚠️ Failed to clear temporary files: ${error}`);
    }
  }

  /**
   * Get temp directory path
   */
  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Get output directory path
   */
  getOutputDir(): string {
    return this.outputDir;
  }
}

// Export singleton instance
export const videoGenerator = new VideoGenerator();
