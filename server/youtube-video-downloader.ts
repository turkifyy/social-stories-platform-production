import ytdl from '@distube/ytdl-core';
import { firestoreService } from './firestore';
import { r2Storage } from './r2-storage';
import { googleTrendsService } from './google-trends';
import type { storyCategories } from '@shared/schema';

interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  duration: number;
  channel: string;
  viewCount: number;
  likeCount: number;
  thumbnail: string;
  url: string;
}

interface TrendingVideoResult {
  videoUrl: string;
  title: string;
  description: string;
  trendingTopic: string;
  duration: number;
}

const MAX_VIDEO_DURATION = 60;
const MIN_VIDEO_DURATION = 10;

export class YouTubeVideoDownloader {
  private apiKey: string | null = null;

  async initialize() {
    const youtubeConfig = await firestoreService.getAPIConfig('youtube');
    
    if (!youtubeConfig?.apiKey) {
      throw new Error('YouTube API key not configured');
    }

    this.apiKey = youtubeConfig.apiKey;
  }

  async searchYouTubeShortsVideo(query: string): Promise<YouTubeVideoInfo[]> {
    if (!this.apiKey) {
      await this.initialize();
    }

    try {
      console.log(`🔍 Searching YouTube Shorts for: "${query}"`);

      const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&` +
        `q=${encodeURIComponent(query)}&` +
        `type=video&` +
        `videoDuration=short&` +
        `videoDefinition=high&` +
        `maxResults=20&` +
        `order=viewCount&` +
        `relevanceLanguage=en&` +
        `safeSearch=strict&` +
        `key=${this.apiKey}`;

      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        throw new Error(`YouTube API error: ${errorData.error?.message || searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.items || searchData.items.length === 0) {
        throw new Error('No videos found for this query');
      }

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,contentDetails,statistics&` +
        `id=${videoIds}&` +
        `key=${this.apiKey}`;

      const detailsResponse = await fetch(detailsUrl);

      if (!detailsResponse.ok) {
        throw new Error('Failed to fetch video details');
      }

      const detailsData = await detailsResponse.json();

      const videos: YouTubeVideoInfo[] = detailsData.items
        .map((item: any) => {
          const duration = this.parseDuration(item.contentDetails.duration);
          
          return {
            videoId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            duration,
            channel: item.snippet.channelTitle,
            viewCount: parseInt(item.statistics.viewCount || '0'),
            likeCount: parseInt(item.statistics.likeCount || '0'),
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
            url: `https://www.youtube.com/watch?v=${item.id}`,
          };
        })
        .filter((video: YouTubeVideoInfo) => {
          return video.duration >= MIN_VIDEO_DURATION && video.duration <= MAX_VIDEO_DURATION;
        })
        .sort((a: YouTubeVideoInfo, b: YouTubeVideoInfo) => {
          const scoreA = a.viewCount + (a.likeCount * 10);
          const scoreB = b.viewCount + (b.likeCount * 10);
          return scoreB - scoreA;
        });

      if (videos.length === 0) {
        throw new Error(`No videos found with duration between ${MIN_VIDEO_DURATION}-${MAX_VIDEO_DURATION} seconds`);
      }

      console.log(`✅ Found ${videos.length} suitable YouTube videos`);
      return videos;
    } catch (error: any) {
      console.error('Error searching YouTube videos:', error);
      throw new Error(`فشل في البحث عن فيديوهات YouTube: ${error.message}`);
    }
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  async downloadVideo(videoUrl: string): Promise<Buffer> {
    try {
      console.log(`📥 Downloading video from: ${videoUrl}`);

      const info = await ytdl.getInfo(videoUrl);
      
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highestvideo',
        filter: (format) => {
          return format.container === 'mp4' && 
                 format.hasVideo === true && 
                 format.hasAudio === true &&
                 (format.qualityLabel === '720p' || format.qualityLabel === '1080p' || format.qualityLabel === '480p');
        }
      });

      if (!format) {
        throw new Error('No suitable HD MP4 format found');
      }

      console.log(`📊 Selected format: ${format.qualityLabel} (${format.container})`);

      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        const stream = ytdl.downloadFromInfo(info, { format });
        
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`✅ Downloaded ${buffer.length} bytes`);
          resolve(buffer);
        });

        stream.on('error', (error: Error) => {
          console.error('Download stream error:', error);
          reject(new Error(`فشل تحميل الفيديو: ${error.message}`));
        });
      });
    } catch (error: any) {
      console.error('Error downloading video:', error);
      
      if (error.message.includes('private video')) {
        throw new Error('الفيديو خاص ولا يمكن تحميله');
      } else if (error.message.includes('age')) {
        throw new Error('الفيديو محظور بسبب قيود العمر');
      } else if (error.message.includes('copyright')) {
        throw new Error('الفيديو محمي بحقوق النشر');
      }
      
      throw new Error(`فشل في تحميل الفيديو: ${error.message}`);
    }
  }

  async uploadToR2(videoBuffer: Buffer, fileName: string): Promise<string> {
    try {
      console.log(`☁️  Uploading to R2: ${fileName}`);
      
      const url = await r2Storage.uploadFile(videoBuffer, fileName, {
        contentType: 'video/mp4',
        metadata: {
          source: 'youtube-trending-video',
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ Uploaded to R2 successfully`);
      return url;
    } catch (error: any) {
      console.error('Error uploading to R2:', error);
      throw new Error(`فشل في رفع الفيديو إلى التخزين: ${error.message}`);
    }
  }

  async generateTrendingVideo(category: typeof storyCategories[number]): Promise<TrendingVideoResult> {
    console.log(`🎬 Generating trending YouTube video for category: ${category}`);

    const searchQuery = await googleTrendsService.getBestSearchQueryForCategory(category);
    console.log(`🔎 Using trending search query: "${searchQuery}"`);

    const videos = await this.searchYouTubeShortsVideo(searchQuery);

    for (const video of videos) {
      try {
        console.log(`🎥 Trying video: ${video.title} (${video.duration}s)`);
        console.log(`   Views: ${video.viewCount.toLocaleString()}, Likes: ${video.likeCount.toLocaleString()}`);

        if (video.duration > MAX_VIDEO_DURATION) {
          console.log(`⏭️  Skipping - Video too long (${video.duration}s > ${MAX_VIDEO_DURATION}s)`);
          continue;
        }

        const videoBuffer = await this.downloadVideo(video.url);
        console.log(`⬇️  Downloaded video: ${videoBuffer.length} bytes`);

        const fileName = `trending-videos/${category}/${Date.now()}-${video.videoId}.mp4`;
        const videoUrl = await this.uploadToR2(videoBuffer, fileName);

        return {
          videoUrl,
          title: video.title,
          description: video.description.substring(0, 200),
          trendingTopic: searchQuery,
          duration: video.duration,
        };
      } catch (error: any) {
        console.error(`❌ Failed to process video ${video.videoId}:`, error.message);

        if (videos.indexOf(video) === videos.length - 1) {
          throw new Error('فشل في معالجة جميع الفيديوهات المتاحة. يرجى المحاولة مرة أخرى.');
        }

        console.log(`⏳ Trying next video...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Failed to process any video. Please try again.');
  }
}

export const youtubeVideoDownloader = new YouTubeVideoDownloader();
