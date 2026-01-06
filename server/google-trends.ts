// @ts-ignore - google-trends-api doesn't have types
import googleTrends from 'google-trends-api';
import type { storyCategories } from '@shared/schema';

export interface TrendQueryResult {
  category: string;
  trendingTerm: string;
  priority: number;
  country?: string;
  language?: string;
}

interface TrendingSearchResult {
  title: string;
  formattedTraffic: string;
  relatedQueries: string[];
}

interface CountryPriority {
  geo: string;
  language: string;
  priority: number;
  keywords: string[];
}

const TV_SHOWS_PRIORITY: CountryPriority[] = [
  { geo: 'TR', language: 'tr', priority: 1, keywords: ['dizi', 'Turkish series', 'Türk dizisi', 'yeni bölüm', 'turkish drama'] },
  { geo: 'US', language: 'en', priority: 2, keywords: ['TV series', 'new episode', 'trending show', 'Netflix series', 'HBO series'] },
  { geo: 'IN', language: 'hi', priority: 3, keywords: ['Hindi serial', 'Indian drama', 'TV show India', 'new episode', 'Indian series'] },
  { geo: 'MX', language: 'es', priority: 4, keywords: ['telenovela', 'serie mexicana', 'nuevo episodio', 'drama latino', 'novela'] },
];

const MOVIES_PRIORITY: CountryPriority[] = [
  { geo: 'US', language: 'en', priority: 1, keywords: ['new movie 2025', 'Hollywood film', 'box office', 'trending movie', 'blockbuster'] },
];

const CATEGORY_MAPPING: Record<typeof storyCategories[number], { geo: string; category: number }> = {
  'movies': { geo: 'US', category: 3 },
  'tv_shows': { geo: 'US', category: 3 },
  'sports': { geo: 'US', category: 20 },
  'recipes': { geo: 'US', category: 71 },
  'gaming': { geo: 'US', category: 8 },
  'apps': { geo: 'US', category: 5 },
  'tv_channels': { geo: 'US', category: 3 },
};

const CATEGORY_KEYWORDS: Record<typeof storyCategories[number], string> = {
  'movies': 'movie',
  'tv_shows': 'tv show',
  'sports': 'sport',
  'recipes': 'recipe',
  'gaming': 'game',
  'apps': 'app',
  'tv_channels': 'TV channel',
};

export class GoogleTrendsService {
  async getTrendingSearchQueries(category: typeof storyCategories[number]): Promise<string[]> {
    try {
      console.log(`🔍 Getting trending topics for category: ${category}`);

      const { geo, category: categoryId } = CATEGORY_MAPPING[category];
      const keyword = CATEGORY_KEYWORDS[category];

      const results = await googleTrends.relatedQueries({
        keyword,
        geo,
        category: categoryId,
        hl: 'en-US',
      });

      const data = JSON.parse(results);
      
      const topQueries: string[] = [];
      
      if (data?.default?.rankedList?.[0]?.rankedKeyword) {
        const queries = data.default.rankedList[0].rankedKeyword
          .slice(0, 10)
          .map((item: any) => item.query)
          .filter((query: string) => query && query.length > 0);
        
        topQueries.push(...queries);
      }

      if (topQueries.length === 0) {
        console.log('⚠️  No trending queries found, using category keywords');
        return [keyword];
      }

      console.log(`✅ Found ${topQueries.length} trending queries:`, topQueries);
      return topQueries;
    } catch (error: any) {
      console.error('Error fetching Google Trends:', error);
      const fallback = CATEGORY_KEYWORDS[category];
      console.log(`⚠️  Using fallback keyword: ${fallback}`);
      return [fallback];
    }
  }

  async getDailyTrends(geo: string = 'US'): Promise<TrendingSearchResult[]> {
    try {
      console.log(`📊 Getting daily trends for: ${geo}`);

      const results = await googleTrends.dailyTrends({
        geo,
      });

      const data = JSON.parse(results);
      
      const trends: TrendingSearchResult[] = [];

      if (data?.default?.trendingSearchesDays?.[0]?.trendingSearches) {
        const trendingSearches = data.default.trendingSearchesDays[0].trendingSearches;
        
        for (const search of trendingSearches.slice(0, 20)) {
          trends.push({
            title: search.title.query,
            formattedTraffic: search.formattedTraffic,
            relatedQueries: search.relatedQueries?.map((q: any) => q.query) || [],
          });
        }
      }

      console.log(`✅ Found ${trends.length} daily trends`);
      return trends;
    } catch (error: any) {
      console.error('Error fetching daily trends:', error);
      return [];
    }
  }

  async getRelatedQueries(keyword: string, geo: string = 'US'): Promise<string[]> {
    try {
      console.log(`🔎 Getting related queries for: "${keyword}"`);

      const results = await googleTrends.relatedQueries({
        keyword,
        geo,
        hl: 'en-US',
      });

      const data = JSON.parse(results);
      
      const queries: string[] = [];

      if (data?.default?.rankedList?.[0]?.rankedKeyword) {
        const rankedQueries = data.default.rankedList[0].rankedKeyword
          .slice(0, 15)
          .map((item: any) => item.query)
          .filter((query: string) => query && query.length > 0);
        
        queries.push(...rankedQueries);
      }

      console.log(`✅ Found ${queries.length} related queries`);
      return queries;
    } catch (error: any) {
      console.error('Error fetching related queries:', error);
      return [keyword];
    }
  }

  async getBestSearchQueryForCategory(category: typeof storyCategories[number]): Promise<string> {
    const trendingQueries = await this.getTrendingSearchQueries(category);
    
    if (trendingQueries.length === 0) {
      return CATEGORY_KEYWORDS[category];
    }

    const randomIndex = Math.floor(Math.random() * Math.min(5, trendingQueries.length));
    return trendingQueries[randomIndex];
  }

  async getTrendingByPriority(category: typeof storyCategories[number]): Promise<TrendQueryResult[]> {
    const results: TrendQueryResult[] = [];

    if (category === 'tv_shows') {
      for (const countryConfig of TV_SHOWS_PRIORITY) {
        try {
          console.log(`🔍 Searching trends for TV shows in ${countryConfig.geo}...`);
          
          const keyword = countryConfig.keywords[0];
          const queryResults = await googleTrends.relatedQueries({
            keyword,
            geo: countryConfig.geo,
            category: 3,
            hl: countryConfig.language,
          });

          const data = JSON.parse(queryResults);
          
          if (data?.default?.rankedList?.[0]?.rankedKeyword) {
            const queries = data.default.rankedList[0].rankedKeyword
              .slice(0, 5)
              .map((item: any) => item.query)
              .filter((query: string) => query && query.length > 0);
            
            for (const term of queries) {
              results.push({
                category: 'tv_shows',
                trendingTerm: term,
                priority: countryConfig.priority,
                country: countryConfig.geo,
                language: countryConfig.language,
              });
            }
          }

          console.log(`✅ Found ${results.filter(r => r.country === countryConfig.geo).length} trends from ${countryConfig.geo}`);
        } catch (error: any) {
          console.error(`Error fetching trends for ${countryConfig.geo}:`, error.message);
        }
      }
    } else if (category === 'movies') {
      for (const countryConfig of MOVIES_PRIORITY) {
        try {
          console.log(`🎬 Searching trends for movies in ${countryConfig.geo}...`);
          
          const keyword = countryConfig.keywords[0];
          const queryResults = await googleTrends.relatedQueries({
            keyword,
            geo: countryConfig.geo,
            category: 3,
            hl: countryConfig.language,
          });

          const data = JSON.parse(queryResults);
          
          if (data?.default?.rankedList?.[0]?.rankedKeyword) {
            const queries = data.default.rankedList[0].rankedKeyword
              .slice(0, 10)
              .map((item: any) => item.query)
              .filter((query: string) => query && query.length > 0);
            
            for (const term of queries) {
              results.push({
                category: 'movies',
                trendingTerm: term,
                priority: countryConfig.priority,
                country: countryConfig.geo,
                language: countryConfig.language,
              });
            }
          }

          console.log(`✅ Found ${results.length} movie trends`);
        } catch (error: any) {
          console.error(`Error fetching movie trends:`, error.message);
        }
      }
    } else {
      const queries = await this.getTrendingSearchQueries(category);
      for (let i = 0; i < queries.length; i++) {
        results.push({
          category,
          trendingTerm: queries[i],
          priority: i + 1,
          country: 'US',
          language: 'en',
        });
      }
    }

    results.sort((a, b) => a.priority - b.priority);
    
    console.log(`📊 Total trend results for ${category}:`, results.length);
    return results;
  }

  async getBestTrendForCategory(category: typeof storyCategories[number]): Promise<TrendQueryResult> {
    const trends = await this.getTrendingByPriority(category);
    
    if (trends.length === 0) {
      return {
        category,
        trendingTerm: CATEGORY_KEYWORDS[category],
        priority: 999,
        country: 'US',
        language: 'en',
      };
    }

    const highPriorityTrends = trends.filter(t => t.priority <= 2);
    const targetTrends = highPriorityTrends.length > 0 ? highPriorityTrends : trends;
    
    const randomIndex = Math.floor(Math.random() * Math.min(3, targetTrends.length));
    return targetTrends[randomIndex];
  }
}

export const googleTrendsService = new GoogleTrendsService();
