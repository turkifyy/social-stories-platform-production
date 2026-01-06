/**
 * RAWG Game Service - Fetches trending and popular games from RAWG API
 * https://rawg.io/apidocs
 */

export interface RAWGGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  backgroundImage: string | null;
  rating: number;
  ratingTop: number;
  ratingsCount: number;
  metacritic: number | null;
  playtime: number;
  genres: { id: number; name: string; slug: string }[];
  platforms: { platform: { id: number; name: string; slug: string } }[];
  tags: { id: number; name: string; slug: string }[];
  shortDescription?: string;
}

export interface RAWGGameDetails extends RAWGGame {
  description: string;
  descriptionRaw: string;
  website: string | null;
  developers: { id: number; name: string; slug: string }[];
  publishers: { id: number; name: string; slug: string }[];
}

interface RAWGAPIResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

const POPULAR_GAMES_FALLBACK: RAWGGame[] = [
  {
    id: 1,
    slug: 'grand-theft-auto-v',
    name: 'Grand Theft Auto V',
    released: '2013-09-17',
    backgroundImage: 'https://media.rawg.io/media/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg',
    rating: 4.47,
    ratingTop: 5,
    ratingsCount: 6821,
    metacritic: 92,
    playtime: 73,
    genres: [{ id: 4, name: 'Action', slug: 'action' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 31, name: 'Singleplayer', slug: 'singleplayer' }],
  },
  {
    id: 2,
    slug: 'fortnite',
    name: 'Fortnite',
    released: '2017-07-21',
    backgroundImage: 'https://media.rawg.io/media/games/dcb/dcbb67f371a9a28ac4f74a71fb73a486.jpg',
    rating: 3.85,
    ratingTop: 5,
    ratingsCount: 5000,
    metacritic: 81,
    playtime: 150,
    genres: [{ id: 4, name: 'Action', slug: 'action' }, { id: 59, name: 'Massively Multiplayer', slug: 'massively-multiplayer' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 7, name: 'Multiplayer', slug: 'multiplayer' }],
  },
  {
    id: 3,
    slug: 'minecraft',
    name: 'Minecraft',
    released: '2011-11-18',
    backgroundImage: 'https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg',
    rating: 4.42,
    ratingTop: 5,
    ratingsCount: 6500,
    metacritic: 93,
    playtime: 120,
    genres: [{ id: 4, name: 'Action', slug: 'action' }, { id: 3, name: 'Adventure', slug: 'adventure' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 31, name: 'Singleplayer', slug: 'singleplayer' }],
  },
  {
    id: 4,
    slug: 'call-of-duty-warzone',
    name: 'Call of Duty: Warzone',
    released: '2020-03-10',
    backgroundImage: 'https://media.rawg.io/media/games/410/41033a495ce8f7fd4b0934bdb975f12a.jpg',
    rating: 3.65,
    ratingTop: 4,
    ratingsCount: 4200,
    metacritic: 80,
    playtime: 45,
    genres: [{ id: 2, name: 'Shooter', slug: 'shooter' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 7, name: 'Multiplayer', slug: 'multiplayer' }],
  },
  {
    id: 5,
    slug: 'valorant',
    name: 'Valorant',
    released: '2020-06-02',
    backgroundImage: 'https://media.rawg.io/media/games/179/179245a3693049a11a25b900ab18f8f7.jpg',
    rating: 3.75,
    ratingTop: 4,
    ratingsCount: 3800,
    metacritic: 80,
    playtime: 60,
    genres: [{ id: 2, name: 'Shooter', slug: 'shooter' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 7, name: 'Multiplayer', slug: 'multiplayer' }],
  },
  {
    id: 6,
    slug: 'league-of-legends',
    name: 'League of Legends',
    released: '2009-10-27',
    backgroundImage: 'https://media.rawg.io/media/games/78b/78bc81e247fc7e77af700cbd632a9297.jpg',
    rating: 3.98,
    ratingTop: 5,
    ratingsCount: 5200,
    metacritic: 78,
    playtime: 200,
    genres: [{ id: 59, name: 'Massively Multiplayer', slug: 'massively-multiplayer' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 7, name: 'Multiplayer', slug: 'multiplayer' }],
  },
  {
    id: 7,
    slug: 'apex-legends',
    name: 'Apex Legends',
    released: '2019-02-04',
    backgroundImage: 'https://media.rawg.io/media/games/737/737ea5662211d2e0bbd6f5989189e4f1.jpg',
    rating: 3.85,
    ratingTop: 4,
    ratingsCount: 4100,
    metacritic: 89,
    playtime: 55,
    genres: [{ id: 2, name: 'Shooter', slug: 'shooter' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 7, name: 'Multiplayer', slug: 'multiplayer' }],
  },
  {
    id: 8,
    slug: 'genshin-impact',
    name: 'Genshin Impact',
    released: '2020-09-28',
    backgroundImage: 'https://media.rawg.io/media/games/d1a/d1a2e99ade53494c6330a0ed945fe823.jpg',
    rating: 4.15,
    ratingTop: 5,
    ratingsCount: 4800,
    metacritic: 84,
    playtime: 100,
    genres: [{ id: 4, name: 'Action', slug: 'action' }, { id: 5, name: 'RPG', slug: 'role-playing-games-rpg' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 31, name: 'Singleplayer', slug: 'singleplayer' }],
  },
  {
    id: 9,
    slug: 'roblox',
    name: 'Roblox',
    released: '2006-09-01',
    backgroundImage: 'https://media.rawg.io/media/games/22d/22de4a95eea1fb16f389ba93a0a98982.jpg',
    rating: 3.55,
    ratingTop: 4,
    ratingsCount: 3500,
    metacritic: null,
    playtime: 80,
    genres: [{ id: 4, name: 'Action', slug: 'action' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 7, name: 'Multiplayer', slug: 'multiplayer' }],
  },
  {
    id: 10,
    slug: 'elden-ring',
    name: 'Elden Ring',
    released: '2022-02-25',
    backgroundImage: 'https://media.rawg.io/media/games/b29/b294fdd866dcdb643e7bab370a552855.jpg',
    rating: 4.35,
    ratingTop: 5,
    ratingsCount: 6100,
    metacritic: 96,
    playtime: 80,
    genres: [{ id: 4, name: 'Action', slug: 'action' }, { id: 5, name: 'RPG', slug: 'role-playing-games-rpg' }],
    platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
    tags: [{ id: 31, name: 'Singleplayer', slug: 'singleplayer' }],
  },
];

export class RAWGGameService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.rawg.io/api';
  private cachedGames: RAWGGame[] = [];
  private cacheTimestamp: number = 0;
  private cacheDuration = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.apiKey = process.env.RAWG_API_KEY || null;
    if (!this.apiKey) {
      console.log('⚠️ RAWG_API_KEY not set, using fallback popular games list');
    } else {
      console.log('✅ RAWG API key configured');
    }
  }

  private async fetchFromAPI<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
    if (!this.apiKey) {
      return null;
    }

    const queryParams = new URLSearchParams({
      key: this.apiKey,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });

    const url = `${this.baseUrl}${endpoint}?${queryParams}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SocialStoriesScheduler/1.0',
        },
      });

      if (!response.ok) {
        console.error(`RAWG API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      console.error('RAWG API fetch error:', error);
      return null;
    }
  }

  private mapGameData(game: any): RAWGGame {
    return {
      id: game.id,
      slug: game.slug,
      name: game.name,
      released: game.released,
      backgroundImage: game.background_image,
      rating: game.rating || 0,
      ratingTop: game.rating_top || 5,
      ratingsCount: game.ratings_count || 0,
      metacritic: game.metacritic,
      playtime: game.playtime || 0,
      genres: (game.genres || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
      })),
      platforms: (game.platforms || []).map((p: any) => ({
        platform: {
          id: p.platform?.id || 0,
          name: p.platform?.name || '',
          slug: p.platform?.slug || '',
        },
      })),
      tags: (game.tags || []).slice(0, 5).map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      })),
      shortDescription: game.short_screenshots?.[0]?.image || undefined,
    };
  }

  async getPopularGames(count: number = 10): Promise<RAWGGame[]> {
    // Check cache
    if (this.cachedGames.length > 0 && Date.now() - this.cacheTimestamp < this.cacheDuration) {
      console.log('📦 Using cached popular games');
      return this.cachedGames.slice(0, count);
    }

    console.log('🎮 Fetching popular games from RAWG...');

    const data = await this.fetchFromAPI<RAWGAPIResponse>('/games', {
      ordering: '-added',
      page_size: Math.min(count * 2, 40), // Fetch more to filter
      metacritic: '70,100', // Only high-quality games
    });

    if (data && data.results && data.results.length > 0) {
      this.cachedGames = data.results
        .filter((game: any) => game.background_image) // Only games with images
        .map((game: any) => this.mapGameData(game));
      this.cacheTimestamp = Date.now();
      console.log(`✅ Fetched ${this.cachedGames.length} popular games from RAWG`);
      return this.cachedGames.slice(0, count);
    }

    console.log('⚠️ RAWG API failed, using fallback games');
    return POPULAR_GAMES_FALLBACK.slice(0, count);
  }

  async getRecentPopularGames(count: number = 10): Promise<RAWGGame[]> {
    console.log('🎮 Fetching recent popular games from RAWG...');

    // Get games from the last 2 years
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dateString = twoYearsAgo.toISOString().split('T')[0];

    const data = await this.fetchFromAPI<RAWGAPIResponse>('/games', {
      ordering: '-added',
      page_size: Math.min(count * 2, 40),
      dates: `${dateString},${new Date().toISOString().split('T')[0]}`,
      metacritic: '75,100',
    });

    if (data && data.results && data.results.length > 0) {
      const games = data.results
        .filter((game: any) => game.background_image)
        .map((game: any) => this.mapGameData(game));
      console.log(`✅ Fetched ${games.length} recent popular games`);
      return games.slice(0, count);
    }

    return this.getPopularGames(count);
  }

  async getRandomTrendingGame(): Promise<RAWGGame> {
    const games = await this.getPopularGames(15);
    
    // Weight more heavily towards top games
    const weights = games.map((_, index) => Math.max(1, 15 - index));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < games.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return games[i];
      }
    }
    
    return games[0];
  }

  async getGameDetails(gameId: number): Promise<RAWGGameDetails | null> {
    console.log(`📖 Fetching details for game ID: ${gameId}`);

    const data = await this.fetchFromAPI<any>(`/games/${gameId}`);

    if (!data) {
      return null;
    }

    return {
      ...this.mapGameData(data),
      description: data.description || '',
      descriptionRaw: data.description_raw || '',
      website: data.website,
      developers: (data.developers || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
      })),
      publishers: (data.publishers || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
    };
  }

  async searchGames(query: string, count: number = 5): Promise<RAWGGame[]> {
    console.log(`🔍 Searching games: ${query}`);

    const data = await this.fetchFromAPI<RAWGAPIResponse>('/games', {
      search: query,
      search_precise: 'true',
      page_size: count,
    });

    if (data && data.results && data.results.length > 0) {
      return data.results
        .filter((game: any) => game.background_image)
        .map((game: any) => this.mapGameData(game));
    }

    return [];
  }

  getGameGenresText(game: RAWGGame): string {
    if (!game.genres || game.genres.length === 0) {
      return 'Action';
    }
    return game.genres.map(g => g.name).join(', ');
  }

  getGamePlatformsText(game: RAWGGame): string {
    if (!game.platforms || game.platforms.length === 0) {
      return 'PC, Console, Mobile';
    }
    return game.platforms.slice(0, 3).map(p => p.platform.name).join(', ');
  }

  isValidGame(game: RAWGGame): boolean {
    return !!(
      game.name &&
      game.name.toLowerCase() !== 'game' &&
      game.name.length > 1 &&
      game.backgroundImage
    );
  }
}

export const rawgGameService = new RAWGGameService();
