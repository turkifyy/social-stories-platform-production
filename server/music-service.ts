import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url?: string;
  thumbnailUrl?: string;
  source: 'youtube' | 'spotify' | 'api';
}

interface MusicSearchQuery {
  keyword?: string;
  category?: string;
  tempo?: 'slow' | 'medium' | 'fast';
  mood?: 'energetic' | 'calm' | 'uplifting' | 'dramatic';
}

const MUSIC_QUERY_TEMPLATES: Record<string, string[]> = {
  movies: ['dramatic epic movie trailer music', 'high energy cinema orchestral', 'intense cinematic hybrid track'],
  tv_shows: ['catchy tv show intro theme', 'modern drama series soundtrack', 'engaging television opening'],
  sports: ['powerful stadium rock anthem', 'extreme sports electronic energy', 'fast-paced rhythmic victory theme'],
  recipes: ['upbeat acoustic cooking', 'cheerful kitchen background music', 'fun rhythmic food blog audio'],
  gaming: ['epic cinematic gaming music', 'high energy phonk drift gaming', 'intense hybrid orchestral game music'],
  apps: ['modern corporate tech energy', 'clean upbeat startup background', 'dynamic technology innovation track'],
};

interface SmartMusicMetadata {
  mood: string;
  energy: number; // 1-10
  tags: string[];
}

export class MusicService {
  private tempDir: string;
  private cacheDir: string;
  private downloadedTracks: Map<string, MusicTrack> = new Map();

  constructor(tempDir: string = '/tmp/music-service') {
    this.tempDir = tempDir;
    this.cacheDir = path.join(this.tempDir, 'cache');
    this.initializeDirs();
  }

  private initializeDirs() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Smartly determine mood based on category and current trends
   */
  private getCategoryMetadata(category: string, title?: string): SmartMusicMetadata {
    const titleLower = title?.toLowerCase() || '';
    const defaultMeta: Record<string, SmartMusicMetadata> = {
      movies: { mood: 'dramatic', energy: 8, tags: ['epic', 'orchestral', 'intense', 'trailer'] },
      tv_shows: { mood: 'engaging', energy: 7, tags: ['modern', 'catchy', 'melodic', 'series'] },
      sports: { mood: 'energetic', energy: 10, tags: ['powerful', 'rock', 'fast', 'stadium'] },
      recipes: { mood: 'uplifting', energy: 6, tags: ['acoustic', 'cheerful', 'fun', 'cooking'] },
      gaming: { mood: 'intense', energy: 9, tags: ['electronic', 'epic', 'driving', 'phonk'] },
      apps: { mood: 'innovative', energy: 7, tags: ['clean', 'tech', 'upbeat', 'modern'] },
    };

    let meta = defaultMeta[category] || { mood: 'energetic', energy: 8, tags: ['trending'] };

    // Elite Precision visual context analysis for professional matching
    if (titleLower.includes('action') || titleLower.includes('thriller') || titleLower.includes('حركة') || titleLower.includes('قتال') || titleLower.includes('مغامرة') || titleLower.includes('سباق') || titleLower.includes('انفجار') || titleLower.includes('ضرب') || titleLower.includes('تحدي') || titleLower.includes('سرعة')) {
      meta.energy = 10;
      meta.tags.push('high-octane', 'epic-drums', 'fast-paced', 'cinematic-impact', 'adrenaline-rush', 'orchestral-hybrid', 'warrior-spirit', 'action-trailer', 'percussion-heavy');
    } else if (titleLower.includes('comedy') || titleLower.includes('funny') || titleLower.includes('كوميديا') || titleLower.includes('ضحك') || titleLower.includes('مرح') || titleLower.includes('بهجة') || titleLower.includes('تسلية') || titleLower.includes('مقالب') || titleLower.includes('ترفيه') || titleLower.includes('نكبة')) {
      meta.mood = 'funny';
      meta.energy = 9;
      meta.tags.push('quirky-pizzicato', 'playful-rhythm', 'upbeat-bounce', 'whimsical-melody', 'fun-vibes', 'cheerful-bells', 'comical-bass', 'slapstick-audio');
    } else if (titleLower.includes('scary') || titleLower.includes('horror') || titleLower.includes('رعب') || titleLower.includes('غموض') || titleLower.includes('مرعب') || titleLower.includes('خوف') || titleLower.includes('أشباح') || titleLower.includes('جن') || titleLower.includes('كابوس')) {
      meta.mood = 'horror';
      meta.energy = 6;
      meta.tags.push('dark-ambient-textures', 'tension-riser-effect', 'creepy-atmospheric', 'suspense-drone', 'scary-stinger', 'ghostly-whispers', 'horror-strings', 'unsettling-pads');
    } else if (titleLower.includes('nature') || titleLower.includes('peaceful') || titleLower.includes('طبيعة') || titleLower.includes('جمال') || titleLower.includes('هدوء') || titleLower.includes('استرخاء') || titleLower.includes('تأمل') || titleLower.includes('شلال') || titleLower.includes('بحر')) {
      meta.mood = 'serene';
      meta.energy = 4;
      meta.tags.push('calm-piano-solo', 'ambient-nature-sounds', 'soft-ethereal-strings', 'peaceful-atmosphere', 'zen-garden', 'flowing-water', 'acoustic-guitar', 'morning-dew-vibe');
    } else if (titleLower.includes('tech') || titleLower.includes('future') || titleLower.includes('تقنية') || titleLower.includes('ذكاء') || titleLower.includes('ابتكار') || titleLower.includes('روبوت') || titleLower.includes('فضاء') || titleLower.includes('برمجة') || titleLower.includes('تطور')) {
      meta.mood = 'innovative';
      meta.energy = 8;
      meta.tags.push('cyberpunk-elements', 'modern-electronic-synth', 'digital-pulse-beat', 'hi-tech-texture', 'futuristic-glitch', 'deep-space-ambient', 'tech-minimal', 'ai-generated-style');
    }

    return meta;
  }

  /**
   * Get music suggestions for a specific category with smart energy matching
   */
  async searchMusicForCategory(category: string, title?: string): Promise<MusicTrack[]> {
    const meta = this.getCategoryMetadata(category, title);
    
    const queries = MUSIC_QUERY_TEMPLATES[category] || [
      `high energy ${category} background music`,
      `intense ${meta.mood} instrumental track`,
      `trending viral ${category} audio`,
    ];

    const baseQuery = title ? `${title} ${category}` : queries[Math.floor(Math.random() * queries.length)];
    const smartQuery = `${baseQuery} ${meta.tags.join(' ')} high energy engaging no lyrics`;
    
    console.log(`🧠 Smart Music Search: ${smartQuery} (Category: ${category})`);
    
    try {
      const tracks = await this.searchYouTubeMusic(smartQuery);
      
      if (tracks && tracks.length > 0) {
        // Sort tracks by view count or "engagement factor" if available, or just return top results
        return tracks.slice(0, 10);
      }

      return this.generateMockMusicTracks(category);
    } catch (error) {
      console.warn(`⚠️ Smart music search failed for ${category}:`, error);
      return this.generateMockMusicTracks(category);
    }
  }

  /**
   * Search YouTube Music for tracks
   */
  private async searchYouTubeMusic(query: string): Promise<MusicTrack[]> {
    try {
      // Using yt-dlp to search for music on YouTube
      // This is a simplified version - in production, use a proper music API
      const { stdout } = await execAsync(
        `yt-dlp --dump-json "ytsearch5:${query} 20 seconds" 2>/dev/null || echo '{}'`
      );

      if (stdout && stdout.trim() !== '{}') {
        try {
          const results = JSON.parse(stdout);
          if (Array.isArray(results.entries)) {
            return results.entries.map((entry: any) => ({
              id: entry.id,
              title: entry.title || 'Unknown',
              artist: entry.uploader || 'Unknown Artist',
              duration: entry.duration || 20,
              url: `https://www.youtube.com/watch?v=${entry.id}`,
              thumbnailUrl: entry.thumbnail,
              source: 'youtube' as const,
            }));
          }
        } catch {
          console.warn('Failed to parse YouTube search results');
        }
      }
      
      return [];
    } catch (error) {
      console.warn('YouTube Music search failed:', error);
      return [];
    }
  }

  /**
   * Generate mock music tracks for demo purposes
   */
  private generateMockMusicTracks(category: string): MusicTrack[] {
    const mockTracks: Record<string, MusicTrack[]> = {
      movies: [
        {
          id: 'movie_music_1',
          title: 'Epic Cinema Score',
          artist: 'Composer Studio',
          duration: 20,
          source: 'api',
        },
        {
          id: 'movie_music_2',
          title: 'Dramatic Trailer Music',
          artist: 'Film Composers',
          duration: 20,
          source: 'api',
        },
      ],
      tv_shows: [
        {
          id: 'tv_music_1',
          title: 'Series Opening Theme',
          artist: 'TV Audio Studio',
          duration: 20,
          source: 'api',
        },
      ],
      sports: [
        {
          id: 'sports_music_1',
          title: 'Sports Anthem',
          artist: 'Sports Music Lab',
          duration: 20,
          source: 'api',
        },
      ],
      recipes: [
        {
          id: 'recipe_music_1',
          title: 'Uplifting Cooking Background',
          artist: 'Food Music Studio',
          duration: 20,
          source: 'api',
        },
      ],
      gaming: [
        {
          id: 'gaming_music_1',
          title: 'Epic Game Soundtrack',
          artist: 'Game Audio Composer',
          duration: 20,
          source: 'api',
        },
      ],
      apps: [
        {
          id: 'app_music_1',
          title: 'Tech Startup Theme',
          artist: 'Tech Audio Lab',
          duration: 20,
          source: 'api',
        },
      ],
    };

    return mockTracks[category] || mockTracks.movies;
  }

  /**
   * Download music track and convert to MP3
   */
  async downloadMusic(track: MusicTrack, outputPath: string): Promise<string> {
    try {
      console.log(`📥 Downloading music: ${track.title} by ${track.artist}`);

      // For mock tracks, create a silent MP3
      if (track.source === 'api' || !track.url) {
        return await this.generateSilentMP3(outputPath, track.duration);
      }

      // Download from URL using ffmpeg
      const tmpPath = path.join(this.tempDir, `${track.id}_tmp`);

      // Use yt-dlp to download from YouTube
      if (track.source === 'youtube' && track.url?.includes('youtube')) {
        try {
          const videoId = new URL(track.url).searchParams.get('v') || '';
          if (videoId) {
            await execAsync(
              `yt-dlp -f "bestaudio/best" -x --audio-format mp3 --audio-quality 128K -o "${tmpPath}" "https://www.youtube.com/watch?v=${videoId}"`
            );

            // Check if file exists and copy to output
            if (fs.existsSync(tmpPath + '.mp3')) {
              fs.copyFileSync(tmpPath + '.mp3', outputPath);
              fs.unlinkSync(tmpPath + '.mp3');
              console.log(`✅ Downloaded music: ${outputPath}`);
              return outputPath;
            }
          }
        } catch (error) {
          console.warn(`⚠️ YouTube download failed for ${track.id}:`, error);
          return await this.generateSilentMP3(outputPath, track.duration);
        }
      }

      // Fallback: generate silent MP3
      return await this.generateSilentMP3(outputPath, track.duration);
    } catch (error) {
      console.error(`❌ Music download failed: ${error}`);
      // Generate silent track as fallback
      return await this.generateSilentMP3(outputPath, 20);
    }
  }

  /**
   * Generate a silent MP3 file (for demo/fallback purposes)
   */
  async generateSilentMP3(outputPath: string, durationSeconds: number): Promise<string> {
    try {
      // Use ffmpeg to generate silence
      await execAsync(
        `ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo -t ${durationSeconds} -q:a 9 -acodec libmp3lame "${outputPath}" 2>/dev/null`
      );

      if (fs.existsSync(outputPath)) {
        console.log(`✅ Generated silent MP3: ${outputPath}`);
        return outputPath;
      }

      throw new Error('Failed to generate silent MP3');
    } catch (error) {
      console.error(`❌ Failed to generate silent MP3:`, error);
      throw error;
    }
  }

  /**
   * Trim audio to exact duration
   */
  async trimAudio(inputPath: string, outputPath: string, durationSeconds: number = 20): Promise<string> {
    try {
      console.log(`✂️ Trimming audio to ${durationSeconds}s: ${inputPath}`);

      await execAsync(
        `ffmpeg -i "${inputPath}" -t ${durationSeconds} -q:a 9 -acodec libmp3lame "${outputPath}" 2>/dev/null`
      );

      if (fs.existsSync(outputPath)) {
        console.log(`✅ Audio trimmed: ${outputPath}`);
        return outputPath;
      }

      throw new Error('Failed to trim audio');
    } catch (error) {
      console.error(`❌ Audio trim failed:`, error);
      throw error;
    }
  }

  /**
   * Get audio info (duration, sample rate, etc.)
   */
  async getAudioInfo(audioPath: string): Promise<{ duration: number; sampleRate: number; bitRate?: string }> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:csv=p=0 "${audioPath}"`
      );

      const duration = parseFloat(stdout.trim()) || 0;

      return {
        duration,
        sampleRate: 48000, // Standard sample rate
        bitRate: '128k',
      };
    } catch (error) {
      console.warn(`⚠️ Failed to get audio info:`, error);
      return { duration: 20, sampleRate: 48000 };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error);
    }
  }

  /**
   * Get track from cache or download with better error handling
   */
  async getOrDownloadTrack(
    track: MusicTrack,
    force: boolean = false
  ): Promise<{ path: string; info: MusicTrack }> {
    const cacheKey = `${track.id}_20s.mp3`;
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      // Return cached track if available
      if (!force && fs.existsSync(cachePath)) {
        console.log(`📦 Using cached music: ${track.title}`);
        return { path: cachePath, info: track };
      }

      // Download and cache
      const downloadedPath = await this.downloadMusic(track, cachePath);

      // Verify download was successful
      if (!fs.existsSync(downloadedPath)) {
        throw new Error(`Failed to download music: ${track.title}`);
      }

      // Trim to 20 seconds
      const trimmedPath = path.join(this.tempDir, `${track.id}_trimmed_20s.mp3`);
      const trimmedOutput = await this.trimAudio(downloadedPath, trimmedPath, 20);

      // Verify trim was successful
      if (!fs.existsSync(trimmedOutput)) {
        console.warn(`⚠️ Trimming failed, using original: ${track.title}`);
        fs.copyFileSync(downloadedPath, cachePath);
      } else {
        // Replace cache with trimmed version
        fs.copyFileSync(trimmedOutput, cachePath);
        try {
          fs.unlinkSync(trimmedOutput);
        } catch {
          // Ignore cleanup errors
        }
      }

      return { path: cachePath, info: track };
    } catch (error) {
      console.error(`❌ Error getting track ${track.title}:`, error);
      // Fallback to silent track
      const silentPath = await this.generateSilentMP3(cachePath, track.duration);
      return { path: silentPath, info: track };
    }
  }
}

// Export singleton instance
export const musicService = new MusicService();
