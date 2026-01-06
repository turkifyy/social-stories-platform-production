import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { r2Storage } from './r2-storage';
import ytdl from '@distube/ytdl-core';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

const TEMP_DIR = '/tmp/trailer-downloads';
const MAX_VIDEO_DURATION = 60;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

interface DownloadResult {
  videoBuffer: Buffer;
  title: string;
  duration: number;
  format: string;
}

interface VideoInfo {
  title: string;
  duration: number;
  id: string;
  thumbnail: string;
  description: string;
}

export class YtDlpDownloader {
  private async ensureTempDir(): Promise<void> {
    try {
      if (!fs.existsSync(TEMP_DIR)) {
        await mkdirAsync(TEMP_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async getVideoInfo(videoUrl: string): Promise<VideoInfo> {
    try {
      console.log(`📊 Getting video info for: ${videoUrl}`);
      
      const { stdout } = await execAsync(
        `yt-dlp --dump-json --no-download "${videoUrl}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      
      const info = JSON.parse(stdout);
      
      return {
        title: info.title || 'Unknown',
        duration: info.duration || 0,
        id: info.id || '',
        thumbnail: info.thumbnail || '',
        description: info.description || '',
      };
    } catch (error: any) {
      console.error('Error getting video info:', error);
      throw new Error(`فشل في الحصول على معلومات الفيديو: ${error.message}`);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async trimVideoWithFfmpeg(inputPath: string, outputPath: string, maxDuration: number): Promise<void> {
    const command = `ffmpeg -y -i "${inputPath}" -t ${maxDuration} -c:v libx264 -c:a aac -movflags +faststart "${outputPath}"`;
    console.log(`✂️ Trimming video to ${maxDuration}s with ffmpeg...`);
    
    await execAsync(command, {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 300000
    });
    
    console.log(`✅ Video trimmed successfully`);
  }

  private async downloadWithYtdlCore(videoUrl: string, outputPath: string, maxDuration: number): Promise<{ title: string; duration: number }> {
    console.log(`🔄 Attempting download with ytdl-core for: ${videoUrl}`);
    
    const tempPath = outputPath.replace('.mp4', '_temp.mp4');
    
    try {
      const info = await ytdl.getInfo(videoUrl);
      const title = info.videoDetails.title || 'Unknown';
      const videoDuration = parseInt(info.videoDetails.lengthSeconds) || maxDuration;
      const needsTrimming = videoDuration > maxDuration;
      
      console.log(`📊 Video info: "${title}" (${videoDuration}s)${needsTrimming ? ` - will trim to ${maxDuration}s` : ''}`);
      
      const formats = info.formats.filter(f => 
        f.container === 'mp4' && 
        f.hasVideo && 
        f.hasAudio &&
        f.height && f.height <= 720
      );
      
      let selectedFormat = formats.find(f => f.qualityLabel === '720p') ||
                          formats.find(f => f.qualityLabel === '480p') ||
                          formats.find(f => f.qualityLabel === '360p') ||
                          formats[0];
      
      if (!selectedFormat) {
        const allFormats = info.formats.filter(f => f.hasVideo && f.hasAudio);
        selectedFormat = allFormats[0];
      }
      
      if (!selectedFormat) {
        throw new Error('لم يتم العثور على تنسيق مناسب للفيديو');
      }
      
      console.log(`📊 Selected format: ${selectedFormat.qualityLabel || 'unknown'} (${selectedFormat.container})`);
      
      const downloadPath = needsTrimming ? tempPath : outputPath;
      
      await new Promise<void>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = ytdl.downloadFromInfo(info, { format: selectedFormat });
        
        let downloadedBytes = 0;
        const maxBytes = 150 * 1024 * 1024;
        let aborted = false;
        
        const timeoutId = setTimeout(() => {
          if (!aborted) {
            aborted = true;
            stream.destroy(new Error('Download timeout - exceeded 5 minutes'));
          }
        }, 300000);
        
        stream.on('data', (chunk: Buffer) => {
          if (aborted) return;
          downloadedBytes += chunk.length;
          if (downloadedBytes > maxBytes) {
            aborted = true;
            clearTimeout(timeoutId);
            stream.destroy(new Error('الفيديو كبير جداً (أكثر من 150MB)'));
            return;
          }
          chunks.push(chunk);
        });
        
        stream.on('end', async () => {
          clearTimeout(timeoutId);
          if (aborted) return;
          try {
            const buffer = Buffer.concat(chunks);
            console.log(`✅ ytdl-core downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
            await writeFileAsync(downloadPath, buffer);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        
        stream.on('error', (error: Error) => {
          clearTimeout(timeoutId);
          console.error('ytdl-core stream error:', error.message);
          reject(error);
        });
      });
      
      if (needsTrimming) {
        await this.trimVideoWithFfmpeg(tempPath, outputPath, maxDuration);
        await unlinkAsync(tempPath).catch(() => {});
      }
      
      return { title, duration: Math.min(videoDuration, maxDuration) };
    } catch (error: any) {
      await unlinkAsync(tempPath).catch(() => {});
      await unlinkAsync(outputPath).catch(() => {});
      console.error('ytdl-core download failed:', error.message);
      throw error;
    }
  }

  private async tryDownloadWithCommand(
    videoUrl: string,
    outputPath: string,
    downloadDuration: number,
    formatSpec: string,
    useSection: boolean = true
  ): Promise<void> {
    const commandParts = [
      'yt-dlp',
      `-f "${formatSpec}"`,
      '--merge-output-format mp4',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--geo-bypass',
      '--extractor-retries 5',
      '--socket-timeout 60',
      '--retries 3',
      '--fragment-retries 3',
      '--concurrent-fragments 3',
      '-o', `"${outputPath}"`,
    ];
    
    if (useSection) {
      commandParts.splice(3, 0, `--download-sections "*0-${downloadDuration}"`);
      commandParts.splice(4, 0, '--force-keyframes-at-cuts');
    }
    
    commandParts.push(`"${videoUrl}"`);
    const command = commandParts.join(' ');
    
    console.log(`🔧 Executing: yt-dlp download with format: ${formatSpec}${useSection ? ` (section: 0-${downloadDuration}s)` : ' (full video)'}`);
    
    await execAsync(command, {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 600000
    });
  }

  async downloadTrailerVideo(videoUrl: string, maxDuration: number = MAX_VIDEO_DURATION): Promise<DownloadResult> {
    await this.ensureTempDir();
    
    const timestamp = Date.now();
    const outputPath = path.join(TEMP_DIR, `trailer_${timestamp}.mp4`);
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`📥 Downloading video from: ${videoUrl} (attempt ${attempt}/${MAX_RETRIES})`);
        
        const info = await this.getVideoInfo(videoUrl);
        console.log(`📊 Video: "${info.title}" (${info.duration}s)`);
        
        let downloadDuration = maxDuration;
        
        if (info.duration && info.duration > 0) {
          if (info.duration > maxDuration) {
            console.log(`⚠️ Video is ${info.duration}s, will download first ${maxDuration}s only`);
            downloadDuration = maxDuration;
          } else {
            downloadDuration = info.duration;
          }
        } else {
          console.log(`⚠️ Duration unknown, downloading first ${maxDuration}s`);
        }
        
        const formatConfigs: Array<{ format: string; useSection: boolean }> = [
          { format: 'bv*[height<=720]+ba/b[height<=720]/bv*+ba/b', useSection: true },
          { format: 'bestvideo[height<=720]+bestaudio/best[height<=720]/best', useSection: true },
          { format: 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b', useSection: true },
          { format: 'best[height<=720]/best', useSection: true },
          { format: '22/18/bv*+ba/b', useSection: true },
          { format: 'bv*+ba/b', useSection: false },
          { format: 'best', useSection: false },
        ];
        
        let downloadSuccess = false;
        
        for (const config of formatConfigs) {
          try {
            await this.tryDownloadWithCommand(videoUrl, outputPath, downloadDuration, config.format, config.useSection);
            
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              if (stats.size > 10000) {
                downloadSuccess = true;
                console.log(`✅ Format "${config.format}" succeeded`);
                break;
              } else {
                console.log(`⚠️ Format "${config.format}" produced small file, trying next...`);
                await unlinkAsync(outputPath).catch(() => {});
              }
            } else {
              const files = fs.readdirSync(TEMP_DIR);
              const matchingFile = files.find(f => f.startsWith(`trailer_${timestamp}`) && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));
              if (matchingFile) {
                const actualPath = path.join(TEMP_DIR, matchingFile);
                const stats = fs.statSync(actualPath);
                if (stats.size > 10000) {
                  if (!matchingFile.endsWith('.mp4')) {
                    fs.renameSync(actualPath, outputPath);
                  }
                  downloadSuccess = true;
                  console.log(`✅ Format "${config.format}" succeeded (found: ${matchingFile})`);
                  break;
                }
              }
            }
          } catch (formatError: any) {
            console.log(`⚠️ Format "${config.format}" failed: ${formatError.message?.substring(0, 100) || 'unknown error'}`);
            try {
              if (fs.existsSync(outputPath)) await unlinkAsync(outputPath);
              const files = fs.readdirSync(TEMP_DIR);
              for (const file of files) {
                if (file.startsWith(`trailer_${timestamp}`)) {
                  await unlinkAsync(path.join(TEMP_DIR, file)).catch(() => {});
                }
              }
            } catch {}
            continue;
          }
        }
        
        if (!downloadSuccess) {
          console.log(`⚠️ yt-dlp failed, trying ytdl-core as fallback...`);
          try {
            const ytdlResult = await this.downloadWithYtdlCore(videoUrl, outputPath, maxDuration);
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              if (stats.size > 10000) {
                downloadSuccess = true;
                console.log(`✅ ytdl-core fallback succeeded`);
                const videoBuffer = await readFileAsync(outputPath);
                await unlinkAsync(outputPath);
                return {
                  videoBuffer,
                  title: ytdlResult.title,
                  duration: ytdlResult.duration,
                  format: 'mp4'
                };
              }
            }
          } catch (ytdlError: any) {
            console.log(`⚠️ ytdl-core fallback also failed: ${ytdlError.message}`);
          }
          
          if (!downloadSuccess) {
            throw new Error('فشلت جميع تنسيقات التحميل (yt-dlp و ytdl-core) - قد يكون الفيديو محمياً أو غير متاح');
          }
        }
        
        let videoBuffer: Buffer | null = null;
        
        if (fs.existsSync(outputPath)) {
          videoBuffer = await readFileAsync(outputPath);
          await unlinkAsync(outputPath);
        } else {
          const files = fs.readdirSync(TEMP_DIR);
          const matchingFile = files.find(f => f.startsWith(`trailer_${timestamp}`) && f.endsWith('.mp4'));
          
          if (matchingFile) {
            const actualPath = path.join(TEMP_DIR, matchingFile);
            console.log(`📁 Found output file: ${matchingFile}`);
            videoBuffer = await readFileAsync(actualPath);
            await unlinkAsync(actualPath);
          }
        }
        
        if (!videoBuffer) {
          throw new Error('لم يتم إنشاء ملف الفيديو');
        }
        
        if (videoBuffer.length < 10000) {
          throw new Error('الفيديو المحمّل صغير جداً، قد يكون تالفاً');
        }
        
        console.log(`✅ Downloaded successfully: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        return {
          videoBuffer,
          title: info.title,
          duration: downloadDuration,
          format: 'mp4'
        };
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        try {
          if (fs.existsSync(outputPath)) {
            await unlinkAsync(outputPath);
          }
          const files = fs.readdirSync(TEMP_DIR);
          for (const file of files) {
            if (file.startsWith(`trailer_${timestamp}`)) {
              await unlinkAsync(path.join(TEMP_DIR, file));
            }
          }
        } catch {}
        
        if (attempt < MAX_RETRIES) {
          console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
          await this.delay(RETRY_DELAY);
        }
      }
    }
    
    if (lastError?.message.includes('Sign in')) {
      throw new Error('الفيديو يتطلب تسجيل الدخول');
    } else if (lastError?.message.includes('private')) {
      throw new Error('الفيديو خاص ولا يمكن تحميله');
    } else if (lastError?.message.includes('age')) {
      throw new Error('الفيديو محظور بسبب قيود العمر');
    } else if (lastError?.message.includes('copyright')) {
      throw new Error('الفيديو محمي بحقوق النشر');
    } else if (lastError?.message.includes('unavailable')) {
      throw new Error('الفيديو غير متاح في هذه المنطقة');
    }
    
    throw new Error(`فشل في تحميل الفيديو بعد ${MAX_RETRIES} محاولات: ${lastError?.message || 'خطأ غير معروف'}`);
  }

  async downloadAndUploadToR2(
    videoUrl: string,
    category: string,
    maxDuration: number = MAX_VIDEO_DURATION
  ): Promise<{ url: string; title: string; duration: number }> {
    console.log(`🎬 Starting trailer download for category: ${category}`);
    console.log(`   Video URL: ${videoUrl}`);
    console.log(`   Max duration: ${maxDuration}s`);
    
    const result = await this.downloadTrailerVideo(videoUrl, maxDuration);
    
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `trending-trailers/${category}/${timestamp}-${randomId}-trailer.mp4`;
    
    console.log(`☁️ Uploading to R2: ${fileName}`);
    console.log(`   File size: ${(result.videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Duration: ${result.duration}s`);
    
    const url = await r2Storage.uploadFileWithLongUrl(result.videoBuffer, fileName, {
      contentType: 'video/mp4',
      metadata: {
        source: 'youtube-trailer',
        title: result.title,
        duration: result.duration.toString(),
        category: category,
        uploadedAt: new Date().toISOString(),
      },
    });
    
    console.log(`✅ Uploaded successfully to R2`);
    console.log(`   URL (first 100 chars): ${url.substring(0, 100)}...`);
    
    return {
      url,
      title: result.title,
      duration: result.duration,
    };
  }
}

export const ytDlpDownloader = new YtDlpDownloader();
