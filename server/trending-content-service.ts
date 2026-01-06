import { firestoreService } from './firestore';
import { deepseekSDK } from './deepseek';
import { huggingFaceSDK } from './huggingface';
import { r2Storage } from './r2-storage';

export interface MovieResult {
  title: string;
  poster_url: string;
  description: string;
  rating: number;
  tmdb_id: string;
}

export interface TVSeriesResult {
  title: string;
  language: string;
  country: string;
  poster_url: string;
  description: string;
  trending: boolean;
  rating: number;
  tmdb_id: string;
}

export interface OtherCategoryResult {
  category: string;
  title: string;
  thumbnail_url: string;
  description: string;
  prompt_used: string;
}

export interface GenerationError {
  category: string;
  item_title: string;
  error_type: 'api_error' | 'image_error' | 'other';
  message: string;
}

export interface TrendingContentResponse {
  movies: MovieResult[];
  tv_series: TVSeriesResult[];
  other_categories: OtherCategoryResult[];
  generation_errors: GenerationError[];
}

interface TMDBMovieResult {
  id: number;
  title: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  popularity: number;
}

interface TMDBTVResult {
  id: number;
  name: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  first_air_date?: string;
  origin_country: string[];
  original_language: string;
  popularity: number;
}

const INTERNATIONAL_TV_REGIONS = [
  { countryCode: 'TR', languageCode: 'tr', name: 'Turkish', displayName: 'تركي' },
  { countryCode: 'US', languageCode: 'en', name: 'American', displayName: 'أمريكي' },
  { countryCode: 'IN', languageCode: 'hi', name: 'Indian', displayName: 'هندي' },
  { countryCode: 'KR', languageCode: 'ko', name: 'Korean', displayName: 'كوري' },
];

const OTHER_CATEGORIES = ['sports', 'recipes', 'gaming', 'apps', 'tv_channels'] as const;

const CATEGORY_PROMPTS: Record<string, { titleAr: string; topicPrompt: string; imageStyle: string }> = {
  sports: {
    titleAr: 'مباريات',
    topicPrompt: 'Generate 2 trending sports topics right now globally including football, basketball, tennis, and major leagues. Focus on current matches, tournaments, and breaking sports news.',
    imageStyle: 'dynamic sports action shot, stadium atmosphere, professional photography, energetic, high contrast, dramatic lighting, 4K quality'
  },
  recipes: {
    titleAr: 'وصفات',
    topicPrompt: 'Generate 2 trending food recipes and culinary topics globally including popular dishes, seasonal recipes, and viral food trends on social media.',
    imageStyle: 'delicious food photography, appetizing presentation, warm lighting, professional food styling, gourmet, 4K quality, instagram worthy'
  },
  gaming: {
    titleAr: 'ألعاب',
    topicPrompt: 'Generate 2 trending video games and gaming topics right now including new releases, esports events, popular streamers, and gaming news.',
    imageStyle: 'video game concept art, digital illustration, vibrant colors, futuristic, dynamic composition, 4K quality, epic gaming scene'
  },
  apps: {
    titleAr: 'تطبيقات',
    topicPrompt: 'Generate 2 trending mobile apps and tech topics including new app releases, popular applications, tech innovations, and digital tools.',
    imageStyle: 'modern tech aesthetic, clean minimalist design, sleek interface mockup, professional, gradient colors, 4K quality'
  },
  tv_channels: {
    titleAr: 'قنوات تلفزيونية',
    topicPrompt: 'Generate 2 trending TV channels and broadcast content topics including popular news channels, entertainment networks, sports broadcasting, and streaming platforms.',
    imageStyle: 'modern TV studio, broadcast graphics, professional news set, dynamic lighting, cinematic quality, 4K broadcast aesthetic'
  }
};

export class TrendingContentService {
  private tmdbApiKey: string | null = null;

  async initialize(): Promise<void> {
    const tmdbConfig = await firestoreService.getAPIConfig('tmdb');
    if (tmdbConfig?.apiKey) {
      this.tmdbApiKey = tmdbConfig.apiKey;
    } else if (process.env.TMDB_API_KEY) {
      this.tmdbApiKey = process.env.TMDB_API_KEY;
    }
  }

  async getTrendingContent(): Promise<TrendingContentResponse> {
    await this.initialize();

    const errors: GenerationError[] = [];
    
    const [movies, tvSeries, otherCategories] = await Promise.all([
      this.fetchTrendingMovies(errors),
      this.fetchTrendingTVSeries(errors),
      this.generateOtherCategoriesContent(errors)
    ]);

    return {
      movies,
      tv_series: tvSeries,
      other_categories: otherCategories,
      generation_errors: errors
    };
  }

  private async fetchTrendingMovies(errors: GenerationError[]): Promise<MovieResult[]> {
    if (!this.tmdbApiKey) {
      errors.push({
        category: 'movies',
        item_title: 'All Movies',
        error_type: 'api_error',
        message: 'TMDB API key not configured'
      });
      return [];
    }

    try {
      const url = `https://api.themoviedb.org/3/trending/movie/day?api_key=${this.tmdbApiKey}&language=ar-SA`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
      }

      const data = await response.json();
      const results: TMDBMovieResult[] = data.results || [];

      return results.slice(0, 10).map((movie): MovieResult => ({
        title: movie.title,
        poster_url: movie.poster_path 
          ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
          : '',
        description: movie.overview || 'لا يوجد وصف متاح',
        rating: Math.round(movie.vote_average * 10) / 10,
        tmdb_id: movie.id.toString()
      }));
    } catch (error: any) {
      errors.push({
        category: 'movies',
        item_title: 'All Movies',
        error_type: 'api_error',
        message: error.message
      });
      return [];
    }
  }

  private async fetchTrendingTVSeries(errors: GenerationError[]): Promise<TVSeriesResult[]> {
    if (!this.tmdbApiKey) {
      errors.push({
        category: 'tv_series',
        item_title: 'All TV Series',
        error_type: 'api_error',
        message: 'TMDB API key not configured'
      });
      return [];
    }

    const allShows: TVSeriesResult[] = [];

    for (const region of INTERNATIONAL_TV_REGIONS) {
      try {
        const url = `https://api.themoviedb.org/3/discover/tv?api_key=${this.tmdbApiKey}&language=ar-SA&sort_by=popularity.desc&with_origin_country=${region.countryCode}&with_original_language=${region.languageCode}&vote_count.gte=50&first_air_date.gte=2020-01-01&page=1`;
        
        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();
        const shows: TMDBTVResult[] = (data.results || []).slice(0, 3);

        for (const show of shows) {
          allShows.push({
            title: show.name,
            language: region.languageCode,
            country: region.countryCode,
            poster_url: show.poster_path 
              ? `https://image.tmdb.org/t/p/w780${show.poster_path}`
              : '',
            description: show.overview || 'لا يوجد وصف متاح',
            trending: show.popularity > 100,
            rating: Math.round(show.vote_average * 10) / 10,
            tmdb_id: show.id.toString()
          });
        }
      } catch (error: any) {
        errors.push({
          category: 'tv_series',
          item_title: `${region.name} TV Shows`,
          error_type: 'api_error',
          message: error.message
        });
      }
    }

    allShows.sort((a, b) => b.rating - a.rating);
    return allShows.slice(0, 10);
  }

  private async generateOtherCategoriesContent(errors: GenerationError[]): Promise<OtherCategoryResult[]> {
    const results: OtherCategoryResult[] = [];

    for (const category of OTHER_CATEGORIES) {
      const categoryConfig = CATEGORY_PROMPTS[category];
      
      try {
        const trendingTopics = await this.generateTrendingTopics(category, categoryConfig.topicPrompt, errors);
        
        for (const topic of trendingTopics.slice(0, 2)) {
          try {
            const imagePrompt = await this.generateImagePrompt(category, topic, categoryConfig.imageStyle);
            const thumbnailUrl = await this.generateAndUploadThumbnail(category, topic, imagePrompt, errors);
            
            results.push({
              category: categoryConfig.titleAr,
              title: topic.title,
              thumbnail_url: thumbnailUrl,
              description: topic.description,
              prompt_used: imagePrompt
            });
          } catch (error: any) {
            errors.push({
              category,
              item_title: topic.title,
              error_type: 'image_error',
              message: error.message
            });
          }
        }
      } catch (error: any) {
        errors.push({
          category,
          item_title: `${categoryConfig.titleAr} Topics`,
          error_type: 'api_error',
          message: error.message
        });
      }
    }

    return results;
  }

  private async generateTrendingTopics(
    category: string, 
    topicPrompt: string,
    errors: GenerationError[]
  ): Promise<{ title: string; description: string }[]> {
    try {
      const systemPrompt = `You are an AI that generates trending content topics for social media stories. 
Return ONLY a valid JSON array with no additional text, markdown, or formatting.
Each object must have "title" and "description" fields in Arabic.`;

      const userPrompt = `${topicPrompt}

Return the response as a JSON array like this:
[{"title": "عنوان الموضوع", "description": "وصف مختصر"}]

Generate exactly 2 trending topics for ${category} category. 
All content must be in Arabic.
Return ONLY the JSON array, nothing else.`;

      const response = await deepseekSDK.generateSimple(userPrompt, systemPrompt, {
        temperature: 0.7,
        max_tokens: 800
      });

      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const topics = JSON.parse(cleanResponse);
      return Array.isArray(topics) ? topics : [];
    } catch (error: any) {
      errors.push({
        category,
        item_title: 'Topic Generation',
        error_type: 'api_error',
        message: `DeepSeek error: ${error.message}`
      });
      
      return this.getFallbackTopics(category);
    }
  }

  private getFallbackTopics(category: string): { title: string; description: string }[] {
    const fallbacks: Record<string, { title: string; description: string }[]> = {
      sports: [
        { title: 'مباراة اليوم الحاسمة', description: 'أبرز المباريات المنتظرة في البطولات العالمية' },
        { title: 'نجوم الملاعب', description: 'آخر أخبار نجوم كرة القدم العالمية' }
      ],
      recipes: [
        { title: 'وصفة الشيف', description: 'أشهى الوصفات من المطابخ العالمية' },
        { title: 'حلويات رمضان', description: 'أطيب الحلويات الشرقية والغربية' }
      ],
      gaming: [
        { title: 'أحدث الألعاب', description: 'أقوى إصدارات الألعاب لهذا العام' },
        { title: 'بطولات الإيسبورتس', description: 'آخر أخبار البطولات الإلكترونية' }
      ],
      apps: [
        { title: 'تطبيقات مميزة', description: 'أفضل التطبيقات الجديدة للهواتف الذكية' },
        { title: 'تقنيات حديثة', description: 'أحدث الابتكارات في عالم التكنولوجيا' }
      ],
      tv_channels: [
        { title: 'قناة الأخبار العربية', description: 'أبرز القنوات الإخبارية والتغطيات الحية' },
        { title: 'قنوات الترفيه', description: 'أشهر القنوات الترفيهية والبرامج المميزة' }
      ]
    };
    
    return fallbacks[category] || [];
  }

  private async generateImagePrompt(
    category: string, 
    topic: { title: string; description: string },
    styleGuide: string
  ): Promise<string> {
    try {
      const systemPrompt = 'Generate a concise English image prompt for AI image generation. Be brief, specific, and focus on visual elements only. Max 40 words.';
      
      const userPrompt = `Create an image prompt for a social media story thumbnail.
Topic: ${topic.title} - ${topic.description}
Category: ${category}
Style requirements: ${styleGuide}

Return ONLY the image prompt text, nothing else.`;

      const prompt = await deepseekSDK.generateSimple(userPrompt, systemPrompt, {
        temperature: 0.7,
        max_tokens: 100
      });

      return prompt.trim().replace(/^["']|["']$/g, '');
    } catch (error) {
      return `${styleGuide}, trending ${category} content, social media story format, 9:16 aspect ratio`;
    }
  }

  private async generateAndUploadThumbnail(
    category: string,
    topic: { title: string; description: string },
    imagePrompt: string,
    errors: GenerationError[]
  ): Promise<string> {
    try {
      const storyPrompt = `${imagePrompt}, vertical format 9:16, social media story, high quality, professional`;
      
      const imageResult = await huggingFaceSDK.generateImage(storyPrompt);
      
      const imageBuffer = Buffer.from(imageResult.imageData, 'base64');
      
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const safeTitle = topic.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '-').substring(0, 30);
      const fileName = `trending-thumbnails/${category}/${timestamp}-${randomId}-${safeTitle}.png`;
      
      const publicUrl = await r2Storage.uploadFile(imageBuffer, fileName, {
        contentType: 'image/png',
        metadata: {
          category,
          title: topic.title,
          prompt: imagePrompt,
          source: 'huggingface-flux',
          uploadedAt: new Date().toISOString()
        }
      });
      
      return publicUrl;
    } catch (error: any) {
      throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
  }
}

export const trendingContentService = new TrendingContentService();
