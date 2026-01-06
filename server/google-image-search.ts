import { firestoreService } from './firestore';
import type { storyCategories } from '@shared/schema';

export interface GoogleImageSearchResult {
  imageUrl: string;
  title: string;
  source: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  contextLink?: string;
}

export interface PosterImageMetadata {
  category: string;
  trendingTerm: string;
  imageUrl: string;
  isEdited: boolean;
  episodeNumber?: number;
  platformTargets: string[];
}

export interface ErrorResponse {
  errorType: string;
  description: string;
  step: string;
  details?: Record<string, any>;
}

interface GoogleSearchConfig {
  apiKey: string;
  searchEngineId: string;
}

const CATEGORY_SEARCH_MODIFIERS: Record<typeof storyCategories[number], { 
  searchType: 'poster' | 'thumbnail';
  keywords: string[];
  aspectRatio?: 'portrait' | 'landscape' | 'square';
}> = {
  'movies': { 
    searchType: 'poster',
    keywords: ['movie poster', 'film poster', 'official poster'],
    aspectRatio: 'portrait'
  },
  'tv_shows': { 
    searchType: 'poster',
    keywords: ['TV series poster', 'show poster', 'drama poster'],
    aspectRatio: 'portrait'
  },
  'sports': { 
    searchType: 'thumbnail',
    keywords: ['sports match', 'game highlight', 'sports event'],
    aspectRatio: 'landscape'
  },
  'recipes': { 
    searchType: 'thumbnail',
    keywords: ['food photo', 'dish recipe', 'cooking'],
    aspectRatio: 'square'
  },
  'gaming': { 
    searchType: 'poster',
    keywords: ['official game poster logo', 'video game cover art HD', 'game key art official', 'AAA game poster'],
    aspectRatio: 'portrait'
  },
  'apps': { 
    searchType: 'thumbnail',
    keywords: ['app icon', 'mobile app', 'application'],
    aspectRatio: 'square'
  },
  'tv_channels': { 
    searchType: 'poster',
    keywords: ['TV channel logo HD', 'broadcast network logo', 'television channel branding'],
    aspectRatio: 'landscape'
  },
};

export class GoogleImageSearchService {
  private config: GoogleSearchConfig | null = null;

  async initialize(): Promise<void> {
    const googleConfig = await firestoreService.getAPIConfig('google_trends');
    
    if (googleConfig?.additionalConfig?.searchEngineId && googleConfig?.apiKey) {
      this.config = {
        apiKey: googleConfig.apiKey,
        searchEngineId: googleConfig.additionalConfig.searchEngineId,
      };
    } else if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      this.config = {
        apiKey: process.env.GOOGLE_API_KEY,
        searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
      };
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.config) {
      await this.initialize();
    }
  }

  async searchImages(
    query: string, 
    category: typeof storyCategories[number],
    count: number = 5
  ): Promise<GoogleImageSearchResult[]> {
    await this.ensureInitialized();

    if (!this.config) {
      console.warn('Google Custom Search not configured, using fallback method');
      return this.fallbackImageSearch(query, category);
    }

    const categoryConfig = CATEGORY_SEARCH_MODIFIERS[category];
    const searchQuery = `${query} ${categoryConfig.keywords[0]}`;
    
    try {
      console.log(`🔍 Searching Google Images for: "${searchQuery}"`);

      const params = new URLSearchParams({
        key: this.config.apiKey,
        cx: this.config.searchEngineId,
        q: searchQuery,
        searchType: 'image',
        num: count.toString(),
        imgSize: 'large',
        imgType: 'photo',
        safe: 'active',
        fileType: 'png,jpg',
      });

      if (categoryConfig.aspectRatio === 'portrait') {
        params.append('imgDominantColor', 'black');
      }

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Google Image Search API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('⚠️ No images found, trying fallback');
        return this.fallbackImageSearch(query, category);
      }

      const results: GoogleImageSearchResult[] = data.items.map((item: any) => ({
        imageUrl: item.link,
        title: item.title || query,
        source: 'google',
        thumbnailUrl: item.image?.thumbnailLink,
        width: item.image?.width,
        height: item.image?.height,
        contextLink: item.image?.contextLink,
      }));

      console.log(`✅ Found ${results.length} images from Google`);
      return results;

    } catch (error: any) {
      console.error('Google Image Search error:', error.message);
      return this.fallbackImageSearch(query, category);
    }
  }

  async searchPosterImage(
    query: string,
    category: 'movies' | 'tv_shows'
  ): Promise<GoogleImageSearchResult | null> {
    const results = await this.searchImages(query, category, 10);
    
    if (results.length === 0) {
      return null;
    }

    const validPosters = results.filter(r => {
      if (r.width && r.height) {
        const aspectRatio = r.height / r.width;
        return aspectRatio > 1.2 && aspectRatio < 2.0;
      }
      return true;
    });

    if (validPosters.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(3, validPosters.length));
      return validPosters[randomIndex];
    }

    return results[0];
  }

  async searchThumbnailImage(
    query: string,
    category: typeof storyCategories[number]
  ): Promise<GoogleImageSearchResult | null> {
    const results = await this.searchImages(query, category, 10);
    
    if (results.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * Math.min(5, results.length));
    return results[randomIndex];
  }

  async searchMultipleImages(
    query: string,
    category: typeof storyCategories[number],
    count: number = 10
  ): Promise<GoogleImageSearchResult[]> {
    const results = await this.searchImages(query, category, count);
    return results.filter(r => {
      const url = r.imageUrl.toLowerCase();
      return !url.endsWith('.svg') && !url.includes('svg+xml');
    });
  }

  private async fallbackImageSearch(
    query: string,
    category: typeof storyCategories[number]
  ): Promise<GoogleImageSearchResult[]> {
    console.log(`📸 Using fallback image search for: "${query}"`);
    
    const categoryConfig = CATEGORY_SEARCH_MODIFIERS[category];
    
    const placeholderResults: GoogleImageSearchResult[] = [{
      imageUrl: this.generatePlaceholderDataUrl(query, category),
      title: query,
      source: 'generated',
      width: 800,
      height: category === 'movies' || category === 'tv_shows' ? 1200 : 800,
    }];

    return placeholderResults;
  }

  private generatePlaceholderDataUrl(title: string, category: typeof storyCategories[number]): string {
    const gradients: Record<typeof storyCategories[number], { from: string; to: string }> = {
      'movies': { from: '#1a1a2e', to: '#16213e' },
      'tv_shows': { from: '#0f0e17', to: '#2a2438' },
      'sports': { from: '#1b4332', to: '#2d6a4f' },
      'recipes': { from: '#7c2d12', to: '#ea580c' },
      'gaming': { from: '#3b0764', to: '#7c3aed' },
      'apps': { from: '#0c4a6e', to: '#0284c7' },
      'tv_channels': { from: '#4c1d95', to: '#7c3aed' },
    };

    const gradient = gradients[category] || gradients['movies'];
    const width = 1080;
    const height = category === 'movies' || category === 'tv_shows' ? 1620 : 1080;

    const svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${gradient.from};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${gradient.to};stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.5)"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#shadow)">
          ${title.substring(0, 25)}
        </text>
        <rect x="${width/2 - 100}" y="${height - 100}" width="200" height="40" rx="20" fill="#f97316"/>
        <text x="50%" y="${height - 76}" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">
          TRENDING
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
  }

  async downloadImage(url: string): Promise<Buffer> {
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }

    console.log(`📥 Downloading image from: ${url.substring(0, 100)}...`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`✅ Downloaded ${buffer.length} bytes`);
      return buffer;

    } catch (error: any) {
      console.error('Image download error:', error.message);
      throw new Error(`فشل في تحميل الصورة: ${error.message}`);
    }
  }

  createErrorResponse(
    errorType: string, 
    description: string, 
    step: string, 
    details?: Record<string, any>
  ): ErrorResponse {
    return {
      errorType,
      description,
      step,
      details,
    };
  }
}

export const googleImageSearchService = new GoogleImageSearchService();
