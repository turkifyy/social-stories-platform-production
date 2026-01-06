/**
 * Google Play Store Service - Fetches trending games from Play Store
 * Uses google-play-scraper library for data extraction
 */
import gplay from 'google-play-scraper';

const gplayAny = gplay as any;

export interface PlayStoreGame {
  appId: string;
  title: string;
  icon: string;
  screenshots: string[];
  developer: string;
  score: number;
  scoreText: string;
  installs: string;
  genre: string;
  genreId: string;
  description: string;
  descriptionHTML?: string;
  summary?: string;
  price: number;
  free: boolean;
  priceText: string;
  currency: string;
  updated?: number;
  version?: string;
  recentChanges?: string;
  contentRating?: string;
  ratings?: number;
  reviews?: number;
  histogram?: { [key: number]: number };
  headerImage?: string;
  video?: string;
  videoImage?: string;
}

export interface TrendingGameResult {
  game: PlayStoreGame;
  rank: number;
  trendingCategory: string;
}

const GAME_CATEGORIES = [
  'GAME_ACTION',
  'GAME_ADVENTURE',
  'GAME_ARCADE',
  'GAME_BOARD',
  'GAME_CARD',
  'GAME_CASINO',
  'GAME_CASUAL',
  'GAME_EDUCATIONAL',
  'GAME_MUSIC',
  'GAME_PUZZLE',
  'GAME_RACING',
  'GAME_ROLE_PLAYING',
  'GAME_SIMULATION',
  'GAME_SPORTS',
  'GAME_STRATEGY',
  'GAME_TRIVIA',
  'GAME_WORD',
];

export class GooglePlayService {
  private cachedTrendingGames: PlayStoreGame[] = [];
  private cacheTimestamp: number = 0;
  private cacheDuration = 30 * 60 * 1000; // 30 minutes cache
  private usedGameIds: Set<string> = new Set(); // Track used games to avoid repetition
  private maxUsedGamesCache = 50; // Max games to track before clearing

  constructor() {
    console.log('✅ Google Play Store service initialized');
  }

  /**
   * Get trending/top games from Google Play Store
   */
  async getTrendingGames(count: number = 20): Promise<PlayStoreGame[]> {
    if (this.cachedTrendingGames.length > 0 && Date.now() - this.cacheTimestamp < this.cacheDuration) {
      console.log('📦 Using cached Play Store trending games');
      return this.cachedTrendingGames.slice(0, count);
    }

    console.log('🎮 Fetching trending games from Google Play Store...');

    try {
      const allGames: PlayStoreGame[] = [];
      
      // Fetch from multiple collections to get diverse trending games
      const collections = [
        gplayAny.collection.TOP_FREE_GAMES,
        gplayAny.collection.TOP_PAID_GAMES,
        gplayAny.collection.TOP_GROSSING_GAMES,
      ];

      for (const collection of collections) {
        try {
          const games = await gplay.list({
            collection,
            num: 15,
            fullDetail: false,
          });

          for (const game of games) {
            if (!allGames.find((g: PlayStoreGame) => g.appId === game.appId)) {
              allGames.push(this.mapGameData(game));
            }
          }
        } catch (error: any) {
          console.log(`⚠️ Failed to fetch ${collection}: ${error.message}`);
        }
      }

      // Also fetch from specific game categories for variety
      const randomCategories = GAME_CATEGORIES.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const category of randomCategories) {
        try {
          const games = await gplayAny.list({
            collection: gplayAny.collection.TOP_FREE,
            category,
            num: 10,
            fullDetail: false,
          });

          for (const game of games) {
            if (!allGames.find((g: PlayStoreGame) => g.appId === game.appId)) {
              allGames.push(this.mapGameData(game));
            }
          }
        } catch (error: any) {
          console.log(`⚠️ Failed to fetch category ${category}: ${error.message}`);
        }
      }

      // Sort by score and filter valid games
      // Relaxed filters to get more real games: rating >= 3.5 AND 10M+ installs
      const MIN_RATING = 3.5; // Relaxed from 4.0 to get more games
      const MIN_INSTALLS = 10_000_000; // 10 million minimum (relaxed from 100M)
      
      this.cachedTrendingGames = allGames
        .filter(game => {
          const isGame = game.genreId?.startsWith('GAME') || game.genre?.toLowerCase().includes('game');
          const installCount = this.parseInstallCount(game.installs);
          const hasValidData = game.icon && game.title && game.score >= MIN_RATING && installCount >= MIN_INSTALLS;
          
          if (!isGame && game.title) {
            console.log(`⚠️ Filtering out non-game: ${game.title} (genreId: ${game.genreId})`);
          }
          return isGame && hasValidData;
        })
        .sort((a, b) => b.score - a.score);
      
      this.cacheTimestamp = Date.now();
      console.log(`✅ Fetched ${this.cachedTrendingGames.length} trending games from Play Store`);
      
      return this.cachedTrendingGames.slice(0, count);
    } catch (error: any) {
      console.error('❌ Failed to fetch trending games:', error.message);
      return this.getFallbackGames();
    }
  }

  /**
   * Get detailed game information including screenshots
   */
  async getGameDetails(appId: string): Promise<PlayStoreGame | null> {
    console.log(`📖 Fetching details for: ${appId}`);

    try {
      const details = await gplay.app({ appId });
      
      return {
        appId: details.appId,
        title: details.title,
        icon: details.icon,
        screenshots: details.screenshots || [],
        developer: details.developer,
        score: details.score || 0,
        scoreText: details.scoreText || '0',
        installs: details.installs || '0',
        genre: details.genre || 'Game',
        genreId: details.genreId || 'GAME',
        description: details.description || '',
        descriptionHTML: details.descriptionHTML || '',
        summary: details.summary || '',
        price: details.price || 0,
        free: details.free !== false,
        priceText: details.priceText || 'Free',
        currency: details.currency || 'USD',
        updated: details.updated,
        version: details.version,
        recentChanges: details.recentChanges,
        contentRating: details.contentRating,
        ratings: details.ratings,
        reviews: details.reviews,
        histogram: details.histogram,
        headerImage: details.headerImage,
        video: details.video,
        videoImage: details.videoImage,
      };
    } catch (error: any) {
      console.error(`❌ Failed to get game details for ${appId}:`, error.message);
      return null;
    }
  }

  /**
   * Get a random trending game with full details - ensures variety by tracking used games
   */
  async getRandomTrendingGame(): Promise<PlayStoreGame> {
    const trendingGames = await this.getTrendingGames(30);
    
    // Get available games list (either trending or fallback)
    let availableGames: PlayStoreGame[];
    let isFallback = false;
    
    if (trendingGames.length === 0) {
      availableGames = this.getFallbackGames();
      isFallback = true;
      console.log(`📦 Using fallback games (${availableGames.length} available)`);
    } else {
      availableGames = trendingGames;
    }

    // Filter out already used games
    let unusedGames = availableGames.filter(game => !this.usedGameIds.has(game.appId));
    
    // If all games have been used, clear the tracking and start fresh
    if (unusedGames.length === 0) {
      console.log('🔄 All games have been used, clearing tracking cache for fresh selection...');
      this.usedGameIds.clear();
      unusedGames = availableGames;
    }
    
    // Clear cache if it gets too large
    if (this.usedGameIds.size >= this.maxUsedGamesCache) {
      console.log('🔄 Used games cache full, clearing oldest entries...');
      this.usedGameIds.clear();
    }

    console.log(`🎲 Selecting from ${unusedGames.length} unused games (${this.usedGameIds.size} already used)`);

    // Random selection with weighted preference for top games
    let selectedGame: PlayStoreGame;
    
    if (unusedGames.length === 1) {
      selectedGame = unusedGames[0];
    } else {
      // Use truly random selection from unused games for better variety
      const randomIndex = Math.floor(Math.random() * unusedGames.length);
      selectedGame = unusedGames[randomIndex];
    }

    // Track this game as used
    this.usedGameIds.add(selectedGame.appId);
    console.log(`✅ Selected game: ${selectedGame.title} (appId: ${selectedGame.appId})`);

    // Get full details for the selected game (only if not using fallback - fallback has complete data)
    if (!isFallback) {
      const details = await this.getGameDetails(selectedGame.appId);
      return details || selectedGame;
    }
    
    return selectedGame;
  }

  /**
   * Search for games on Play Store
   */
  async searchGames(query: string, count: number = 10): Promise<PlayStoreGame[]> {
    console.log(`🔍 Searching Play Store for: ${query}`);

    try {
      const results = await gplay.search({
        term: query,
        num: count,
        fullDetail: false,
      });

      // Filter for games only
      const games = results
        .filter((app: any) => app.genreId?.startsWith('GAME'))
        .map((game: any) => this.mapGameData(game));

      console.log(`✅ Found ${games.length} games matching "${query}"`);
      return games;
    } catch (error: any) {
      console.error(`❌ Search failed for "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Get high-resolution game icon URL
   */
  getHighResIcon(iconUrl: string): string {
    // Play Store icons can be resized by modifying the URL
    // Original: =w240-h480
    // High-res: =w512-h512
    if (iconUrl.includes('=w')) {
      return iconUrl.replace(/=w\d+-h\d+/g, '=w512-h512-rw');
    }
    return iconUrl;
  }

  /**
   * Get high-resolution screenshot URL
   */
  getHighResScreenshot(screenshotUrl: string): string {
    // Increase screenshot resolution
    if (screenshotUrl.includes('=w')) {
      return screenshotUrl.replace(/=w\d+/g, '=w1920');
    }
    return screenshotUrl;
  }

  /**
   * Get best screenshot for poster background - Smart selection algorithm
   * Prioritizes: portrait screenshots for story format, high-quality images, feature-rich screens
   */
  async getBestScreenshot(game: PlayStoreGame): Promise<string | null> {
    let screenshots = game.screenshots;
    
    if (!screenshots || screenshots.length === 0) {
      // Try to get full details
      const details = await this.getGameDetails(game.appId);
      if (details && details.screenshots && details.screenshots.length > 0) {
        screenshots = details.screenshots;
      } else {
        return null;
      }
    }

    console.log(`📸 Analyzing ${screenshots.length} screenshots for best selection...`);

    // For story format (9:16), prefer portrait screenshots
    const portraitScreenshots = screenshots.filter(url => {
      // Portrait screenshots usually have higher height than width in URL
      const heightMatch = url.match(/-h(\d+)/);
      const widthMatch = url.match(/=w(\d+)/);
      if (heightMatch && widthMatch) {
        const height = parseInt(heightMatch[1]);
        const width = parseInt(widthMatch[1]);
        return height > width;
      }
      // Check for portrait indicators in URL
      return url.includes('portrait') || url.includes('-h1920') || url.includes('-h2560');
    });

    // Smart selection: Choose based on screenshot position
    // Middle screenshots (2nd-4th) often show the best features
    let selectedScreenshot: string;
    
    if (portraitScreenshots.length > 0) {
      // Use portrait screenshot - prefer middle ones for best features
      const midIndex = Math.min(Math.floor(portraitScreenshots.length / 2), 2);
      selectedScreenshot = portraitScreenshots[midIndex] || portraitScreenshots[0];
      console.log(`✅ Selected portrait screenshot ${midIndex + 1}/${portraitScreenshots.length}`);
    } else if (screenshots.length >= 3) {
      // Use 2nd or 3rd screenshot which usually shows main features
      const featureIndex = Math.min(2, screenshots.length - 1);
      selectedScreenshot = screenshots[featureIndex];
      console.log(`✅ Selected feature screenshot ${featureIndex + 1}/${screenshots.length}`);
    } else {
      // Fallback to first screenshot
      selectedScreenshot = screenshots[0];
      console.log(`✅ Selected first screenshot (limited options)`);
    }

    return this.getHighResScreenshot(selectedScreenshot);
  }

  /**
   * Get best screenshot for apps (non-games) - Optimized for story posters
   * Enhanced smart algorithm to select the most attractive and professional screenshot
   * Prioritizes: UI-rich screens, portrait orientation, feature displays, high quality
   */
  async getBestAppScreenshot(app: PlayStoreGame): Promise<string | null> {
    let screenshots = app.screenshots;
    
    if (!screenshots || screenshots.length === 0) {
      const details = await this.getAppDetails(app.appId);
      if (details && details.screenshots && details.screenshots.length > 0) {
        screenshots = details.screenshots;
      } else {
        return null;
      }
    }

    console.log(`📱 Enhanced smart screenshot selection: Analyzing ${screenshots.length} screenshots for ${app.title}...`);

    // Score each screenshot based on multiple factors for optimal poster design
    const scoredScreenshots = screenshots.map((url, index) => {
      let score = 0;
      
      // Factor 1: Position priority - Middle screenshots (2nd-4th) typically show best UI/features
      // First screenshot often has promotional text overlay, last ones may be less important
      if (index === 1) score += 40; // 2nd screenshot - typically main UI screen
      else if (index === 2) score += 35; // 3rd screenshot - feature showcase
      else if (index === 3) score += 30; // 4th screenshot - additional features
      else if (index === 4) score += 25; // 5th screenshot
      else if (index === 0) score += 10; // First often has text overlays - lower priority
      else if (index >= 5) score += 15; // Later screenshots
      
      // Factor 2: Portrait orientation strongly preferred for story format (9:16)
      const heightMatch = url.match(/-h(\d+)/);
      const widthMatch = url.match(/=w(\d+)/);
      if (heightMatch && widthMatch) {
        const height = parseInt(heightMatch[1]);
        const width = parseInt(widthMatch[1]);
        if (height > width) {
          score += 30; // Strong portrait orientation bonus
          console.log(`   📐 Screenshot ${index + 1}: Portrait orientation (+30)`);
        } else if (width > height * 1.5) {
          score -= 15; // Landscape penalty for story format
        }
      }
      
      // Factor 3: High resolution indicator - higher quality = better poster
      if (url.includes('=w1920') || url.includes('=w2560') || url.includes('-h2560')) {
        score += 20;
      } else if (url.includes('=w1280') || url.includes('-h1920') || url.includes('-h1600')) {
        score += 15;
      } else if (url.includes('=w1080') || url.includes('-h1200')) {
        score += 10;
      }
      
      // Factor 4: Avoid first screenshot (often has marketing overlays/text)
      if (index === 0) {
        score -= 15; // Penalty for first screenshot
      }
      
      // Factor 5: Prefer variety - slightly favor odd-indexed for visual diversity
      if (index % 2 === 1) {
        score += 5;
      }
      
      return { url, index, score };
    });

    // Sort by score descending
    scoredScreenshots.sort((a, b) => b.score - a.score);
    
    // Select the best scored screenshot (deterministic for consistency)
    // But if top 2 have very close scores (within 5 points), pick the one with better position
    let selectedCandidate = scoredScreenshots[0];
    if (scoredScreenshots.length >= 2) {
      const second = scoredScreenshots[1];
      if (selectedCandidate.score - second.score <= 5 && second.index < selectedCandidate.index) {
        selectedCandidate = second; // Prefer earlier position if scores are close
      }
    }
    
    console.log(`🎯 Screenshot scores: ${scoredScreenshots.slice(0, 5).map(s => `[${s.index + 1}:${s.score}pts]`).join(' ')}`);
    console.log(`✅ Selected screenshot ${selectedCandidate.index + 1}/${screenshots.length} (score: ${selectedCandidate.score}pts) for professional app poster`);
    
    return this.getHighResScreenshot(selectedCandidate.url);
  }

  /**
   * Map raw API data to our interface
   */
  private mapGameData(game: any): PlayStoreGame {
    return {
      appId: game.appId,
      title: game.title,
      icon: game.icon,
      screenshots: game.screenshots || [],
      developer: game.developer || 'Unknown',
      score: game.score || 0,
      scoreText: game.scoreText || '0',
      installs: game.installs || '0',
      genre: game.genre || 'Game',
      genreId: game.genreId || 'GAME',
      description: game.description || '',
      summary: game.summary || '',
      price: game.price || 0,
      free: game.free !== false,
      priceText: game.priceText || 'Free',
      currency: game.currency || 'USD',
    };
  }

  /**
   * Fallback games when API fails
   */
  private getFallbackGames(): PlayStoreGame[] {
    return [
      {
        appId: 'com.supercell.clashofclans',
        title: 'Clash of Clans',
        icon: 'https://play-lh.googleusercontent.com/LByrur1mTmPeNr0ljI-uAUcct1rzmTve5Esau1SwoAUfHgz5OjHIAu6a3_VFqWThM8U=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/CBVb90FxjlDKuQTCXO3aZCZC6bxEEQADMW3FqJK2HJBWrV5jT_4i5p9wnCYA9qVLuPQ=w1920'],
        developer: 'Supercell',
        score: 4.5,
        scoreText: '4.5',
        installs: '500,000,000+',
        genre: 'Strategy',
        genreId: 'GAME_STRATEGY',
        description: 'Epic strategy game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.dts.freefireth',
        title: 'Free Fire',
        icon: 'https://play-lh.googleusercontent.com/WWcssdzTZvx0OsXvnHL5Df_UnE0LMzPvMQefS4sBIJK8avrIwFgMvJh48LDBH4-FJpz_=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/yT1l5ggNiUh-dD0m9-LbL_EEL3Y0qFkX6GZhqfnE0XH_hG9pQ4C1FZ0T2qEP0nQeZ9E=w1920'],
        developer: 'Garena International',
        score: 4.1,
        scoreText: '4.1',
        installs: '1,000,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'Ultimate survival shooter',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.pubg.imobile',
        title: 'PUBG MOBILE',
        icon: 'https://play-lh.googleusercontent.com/JRd05pyBH41qjgsJuWduRJpDeZG0Hn-x9vNNmLqNy8LxE7_4vCEUJVNBQqHzMGz_Cg=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/QqMbDqoRvM-1sJMwfL0_dLiIwKbGHqDq0MHvQVPjLvG_xXXHy9R7kWPnLwGqlz8Z-A=w1920'],
        developer: 'Level Infinite',
        score: 4.2,
        scoreText: '4.2',
        installs: '1,000,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'Battle Royale game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.mojang.minecraftpe',
        title: 'Minecraft',
        icon: 'https://play-lh.googleusercontent.com/VSwHQjcAttxsLE47RuS4PqpC4LT7lCoSjE7Hx5AW_yCxtDvcnsHHvm5CTuL5BPN-uRTP=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/yAtZnNL-9Eb5VYSs8-rZVvLMXb3Fj_nXq0SsYz4IiRBR9HJCeV7CsLsBKjQ9M-c2Og=w1920'],
        developer: 'Mojang',
        score: 4.5,
        scoreText: '4.5',
        installs: '100,000,000+',
        genre: 'Arcade',
        genreId: 'GAME_ARCADE',
        description: 'Explore, build, and survive',
        price: 7.49,
        free: false,
        priceText: '$7.49',
        currency: 'USD',
      },
      {
        appId: 'com.roblox.client',
        title: 'Roblox',
        icon: 'https://play-lh.googleusercontent.com/WNWZaxi9RdJKe2GQM3vqXIAkk69mnIl4Cc8EyZcirr6_qsMEOcp29BmBtXBZQu2ulS8=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/2xXcP4jI_EqFbPr6ySPg1MHgGh5xyElDEF9Kk6IxD6nKD0YZj_M_3nf_0KqEq4rOXQ=w1920'],
        developer: 'Roblox Corporation',
        score: 4.4,
        scoreText: '4.4',
        installs: '500,000,000+',
        genre: 'Adventure',
        genreId: 'GAME_ADVENTURE',
        description: 'Millions of experiences await',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.supercell.brawlstars',
        title: 'Brawl Stars',
        icon: 'https://play-lh.googleusercontent.com/UfoALDKp0CeDKlOF5tl_yL3lj0D3rN-oQlj2U8Ff-tTl3yqP5w6O-8_5BlH0pXl8v8s=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/U7Ig0hS2T4v8j7e3qN9d8jU6B7iKB2qB5Z1NlH8ZbVr4g_L0Z_4hxQjL_WH8CwADKA=w1920'],
        developer: 'Supercell',
        score: 4.3,
        scoreText: '4.3',
        installs: '500,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'Fast-paced multiplayer battles',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.gameloft.android.ANMP.GloftA9HM',
        title: 'Asphalt 9: Legends',
        icon: 'https://play-lh.googleusercontent.com/WA_oh_H3unx6HzntG7SZ2bQ0VQmLW5S6U4fPdBrHnFLz0qNbD8yZW8wy0HnZHEZ8=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/1Y9nJTfFLq4_nNIX9JYxIMX9HZ5xVMqQYK6I0Y2O3E-Vq_xWd7I1nfZ5C1H-Fv2=w1920'],
        developer: 'Gameloft SE',
        score: 4.4,
        scoreText: '4.4',
        installs: '100,000,000+',
        genre: 'Racing',
        genreId: 'GAME_RACING',
        description: 'Arcade racing at its best',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.tencent.ig',
        title: 'PUBG MOBILE LITE',
        icon: 'https://play-lh.googleusercontent.com/N0UxhBVUWJqr7FLN3FNmGZNndLhV5J9K_AoXBr6URmPqZ7FzM9fTlT8nLxP6r4VJ-sI=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/QNf3AH1ZmZ8vJqv3w9U9K3F0l5Q1p9O3n2L8_4a0eGl7G4D_pBz6f3f_lPl8D4nV=w1920'],
        developer: 'Tencent Games',
        score: 4.0,
        scoreText: '4.0',
        installs: '100,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'Battle Royale for all devices',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.king.candycrushsaga',
        title: 'Candy Crush Saga',
        icon: 'https://play-lh.googleusercontent.com/1-hPxafOxdYpYZEOKzNIkSP43HXCNftVJVttoo4ucl7rsMASXW3Xr6GlXURCubE1tA=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/pM7jXE_4vZVrG2Gu9TlE0N_J_Ap8OJvDN0qY1Q_VHAZ0oKEZKGPfFT1Y_TRl4GA=w1920'],
        developer: 'King',
        score: 4.5,
        scoreText: '4.5',
        installs: '1,000,000,000+',
        genre: 'Casual',
        genreId: 'GAME_CASUAL',
        description: 'Sweet puzzle game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.activision.callofduty.shooter',
        title: 'Call of Duty: Mobile',
        icon: 'https://play-lh.googleusercontent.com/D6ixh-XqQ9K3RxdWJyEQ4WESTxmLMoJEDIGW_GmVnGE_mPe-RL-H1-1-1X_-GEDp5dI=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/QxJnLxEVkT8_2H4PYwYxlS_rWqP9rMx6YA1MvAuLq8jM5O0yTxM7JQM_F3vM8nQVhg=w1920'],
        developer: 'Activision Publishing',
        score: 4.3,
        scoreText: '4.3',
        installs: '500,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'Legendary FPS on mobile',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.supercell.clashroyale',
        title: 'Clash Royale',
        icon: 'https://play-lh.googleusercontent.com/rIvZQ_H3hfmexC8vurmLczLs7QiZBSwMf2EKFQIGwSezGxN1H6yG8q2hlNZLHB1Pex8=w512-h512',
        screenshots: [],
        developer: 'Supercell',
        score: 4.2,
        scoreText: '4.2',
        installs: '500,000,000+',
        genre: 'Strategy',
        genreId: 'GAME_STRATEGY',
        description: 'Real-time multiplayer battle',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.ea.game.fifa6_row',
        title: 'EA SPORTS FC Mobile',
        icon: 'https://play-lh.googleusercontent.com/3nMzI6aOmVzxaJ8E2EWOqk-9cGLqK8ECBgvJlBH_eBRL8T8ZFZR6QbE7lJSxRdRcSQ=w512-h512',
        screenshots: [],
        developer: 'Electronic Arts',
        score: 4.1,
        scoreText: '4.1',
        installs: '100,000,000+',
        genre: 'Sports',
        genreId: 'GAME_SPORTS',
        description: 'Ultimate football experience',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.miHoYo.GenshinImpact',
        title: 'Genshin Impact',
        icon: 'https://play-lh.googleusercontent.com/h4MX8h6XFHTCEOiCqK0a7wPT9RfKyZqsIoFQz2bj1zCZ6qn4OWDQe0Tf8hCh7w7zFA=w512-h512',
        screenshots: [],
        developer: 'miHoYo Limited',
        score: 4.2,
        scoreText: '4.2',
        installs: '100,000,000+',
        genre: 'Role Playing',
        genreId: 'GAME_ROLE_PLAYING',
        description: 'Open-world adventure RPG',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.innersloth.spacemafia',
        title: 'Among Us',
        icon: 'https://play-lh.googleusercontent.com/8ddL1kuoNUB5vUvgDVjYY3_6HwQcrg1K2fd_R8soD-e2QYj8fT9cfhfh3G0hnSruLKE=w512-h512',
        screenshots: [],
        developer: 'Innersloth LLC',
        score: 4.3,
        scoreText: '4.3',
        installs: '500,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'Social deduction game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.kiloo.subwaysurf',
        title: 'Subway Surfers',
        icon: 'https://play-lh.googleusercontent.com/6FhY0m1vV_IdHpVuY3nlfQFAVP0xLBWEUVKxCVdKJOk4x0S8EDRjjg8P9j7y0T7VbA=w512-h512',
        screenshots: [],
        developer: 'SYBO Games',
        score: 4.5,
        scoreText: '4.5',
        installs: '1,000,000,000+',
        genre: 'Arcade',
        genreId: 'GAME_ARCADE',
        description: 'Endless runner game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.imangi.templerun2',
        title: 'Temple Run 2',
        icon: 'https://play-lh.googleusercontent.com/RGRT9HqXRhVVv2ACxXYKlxBQgHqLjDnlq_KNvg0Y6mA0LO5lGxvnpPHrG0kA6ZXDSA=w512-h512',
        screenshots: [],
        developer: 'Imangi Studios',
        score: 4.3,
        scoreText: '4.3',
        installs: '1,000,000,000+',
        genre: 'Arcade',
        genreId: 'GAME_ARCADE',
        description: 'Endless running adventure',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.rovio.angrybirds2.revo',
        title: 'Angry Birds 2',
        icon: 'https://play-lh.googleusercontent.com/4n8Wh-3cKBZ_nMYP_aSGMmWJ9_Ee_FoR-3i_iJWr3K0Ih0-l5G8gLq8WEg8RAQXQOA=w512-h512',
        screenshots: [],
        developer: 'Rovio Entertainment',
        score: 4.4,
        scoreText: '4.4',
        installs: '100,000,000+',
        genre: 'Casual',
        genreId: 'GAME_CASUAL',
        description: 'Slingshot fun',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.mobile.legends',
        title: 'Mobile Legends: Bang Bang',
        icon: 'https://play-lh.googleusercontent.com/XBNxPXFfKmJ5RhWoaE_2SUvELCzQRzLl0YmJ4_zX6pG8Nh7FQPMzVe9hI5qQ0Bwx=w512-h512',
        screenshots: [],
        developer: 'Moonton',
        score: 4.2,
        scoreText: '4.2',
        installs: '500,000,000+',
        genre: 'Action',
        genreId: 'GAME_ACTION',
        description: 'MOBA battle arena',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.supercell.hayday',
        title: 'Hay Day',
        icon: 'https://play-lh.googleusercontent.com/pM0RNMvLDQWFY_ELB_Kqr8RJJKBPqHJ6v4YVH_j_OzWQm7k_GjL4O7qZ1X4qO4rA=w512-h512',
        screenshots: [],
        developer: 'Supercell',
        score: 4.4,
        scoreText: '4.4',
        installs: '100,000,000+',
        genre: 'Simulation',
        genreId: 'GAME_SIMULATION',
        description: 'Farm building game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.etermax.preguntados.lite',
        title: 'Trivia Crack',
        icon: 'https://play-lh.googleusercontent.com/MVFL_aYsXD_T3E4JLrPJyOHpB_6HT-JT4Lfl8XhPF4H_W1O7hZhQBN6F_E8MWePh=w512-h512',
        screenshots: [],
        developer: 'etermax',
        score: 4.5,
        scoreText: '4.5',
        installs: '500,000,000+',
        genre: 'Trivia',
        genreId: 'GAME_TRIVIA',
        description: 'Quiz game with friends',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.plarium.raidlegends',
        title: 'RAID: Shadow Legends',
        icon: 'https://play-lh.googleusercontent.com/ByEFfNpklQkP8L-7xAeLHMphP2rLZA9QLQB0TmGcFoC5T3zDqcOCZ3sLh5dV4R8wBA=w512-h512',
        screenshots: [],
        developer: 'Plarium Global Ltd',
        score: 4.3,
        scoreText: '4.3',
        installs: '100,000,000+',
        genre: 'Role Playing',
        genreId: 'GAME_ROLE_PLAYING',
        description: 'Epic fantasy RPG',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.outfit7.talkingtom2',
        title: 'My Talking Tom 2',
        icon: 'https://play-lh.googleusercontent.com/lRU9bKsD8KQ_L6K4dVdP4IqRYsKNPJv3M1qE7FZ_KGp5eQe6U0Q8oV0CaJ7dM_kH=w512-h512',
        screenshots: [],
        developer: 'Outfit7 Limited',
        score: 4.4,
        scoreText: '4.4',
        installs: '500,000,000+',
        genre: 'Casual',
        genreId: 'GAME_CASUAL',
        description: 'Virtual pet adventure',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.miniclip.eightballpool',
        title: '8 Ball Pool',
        icon: 'https://play-lh.googleusercontent.com/N-WvKf_LFM_fdbDFkMT_0LnKmMt0J_PN4jF0V3Z_U7P8nI3K8gMC5L_IXU2v4g0OhQ=w512-h512',
        screenshots: [],
        developer: 'Miniclip.com',
        score: 4.4,
        scoreText: '4.4',
        installs: '500,000,000+',
        genre: 'Sports',
        genreId: 'GAME_SPORTS',
        description: 'Online pool game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.playrix.homescapes',
        title: 'Homescapes',
        icon: 'https://play-lh.googleusercontent.com/H3MKx1YEsRSQf_L8EhVT_CbF3g7L7Wn8R_kVmGMpPXe8XeA_W0o2bTLOT8E8wGqbHQ=w512-h512',
        screenshots: [],
        developer: 'Playrix',
        score: 4.3,
        scoreText: '4.3',
        installs: '500,000,000+',
        genre: 'Puzzle',
        genreId: 'GAME_PUZZLE',
        description: 'Match-3 puzzle game',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.playrix.gardenscapes',
        title: 'Gardenscapes',
        icon: 'https://play-lh.googleusercontent.com/xBUE6lPqMHxfLzI0hFMd7Wb0cRk8Q7FoEJL5mN7sYmB_RQqM3FzR4K2_LBB8fB8p=w512-h512',
        screenshots: [],
        developer: 'Playrix',
        score: 4.3,
        scoreText: '4.3',
        installs: '500,000,000+',
        genre: 'Puzzle',
        genreId: 'GAME_PUZZLE',
        description: 'Garden renovation puzzle',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
    ];
  }

  /**
   * Parse install count string to number (e.g., "100,000,000+" -> 100000000)
   */
  private parseInstallCount(installs: string): number {
    if (!installs) return 0;
    const cleanInstalls = installs.replace(/[,+]/g, '');
    return parseInt(cleanInstalls) || 0;
  }

  /**
   * Get formatted genre text in Arabic
   */
  getGenreArabic(genre: string): string {
    const genreMap: Record<string, string> = {
      'Action': 'أكشن',
      'Adventure': 'مغامرة',
      'Arcade': 'آركيد',
      'Board': 'ألعاب لوحية',
      'Card': 'ألعاب ورق',
      'Casino': 'كازينو',
      'Casual': 'عادية',
      'Educational': 'تعليمية',
      'Music': 'موسيقى',
      'Puzzle': 'ألغاز',
      'Racing': 'سباقات',
      'Role Playing': 'تقمص أدوار',
      'Simulation': 'محاكاة',
      'Sports': 'رياضية',
      'Strategy': 'استراتيجية',
      'Trivia': 'معلومات',
      'Word': 'كلمات',
    };
    return genreMap[genre] || genre;
  }

  /**
   * Format installs count for display
   */
  formatInstalls(installs: string): { ar: string; en: string } {
    const cleanInstalls = installs.replace(/[,+]/g, '');
    const num = parseInt(cleanInstalls);
    
    if (num >= 1000000000) {
      const billions = (num / 1000000000).toFixed(1);
      return { 
        ar: `+${billions} مليار تحميل`, 
        en: `${billions}B+ Downloads` 
      };
    } else if (num >= 1000000) {
      const millions = (num / 1000000).toFixed(0);
      return { 
        ar: `+${millions} مليون تحميل`, 
        en: `${millions}M+ Downloads` 
      };
    } else if (num >= 1000) {
      const thousands = (num / 1000).toFixed(0);
      return { 
        ar: `+${thousands} ألف تحميل`, 
        en: `${thousands}K+ Downloads` 
      };
    }
    return { 
      ar: `+${installs} تحميل`, 
      en: `${installs}+ Downloads` 
    };
  }

  // ============= Apps (Non-Game Applications) Methods =============
  
  private cachedTrendingApps: PlayStoreGame[] = [];
  private appsCacheTimestamp: number = 0;
  private usedAppIds: Set<string> = new Set();
  
  private readonly APP_CATEGORIES = [
    'SOCIAL',
    'COMMUNICATION',
    'PRODUCTIVITY',
    'TOOLS',
    'ENTERTAINMENT',
    'PHOTOGRAPHY',
    'VIDEO_PLAYERS',
    'MUSIC_AND_AUDIO',
    'SHOPPING',
    'FINANCE',
    'HEALTH_AND_FITNESS',
    'EDUCATION',
    'TRAVEL_AND_LOCAL',
    'NEWS_AND_MAGAZINES',
    'FOOD_AND_DRINK',
    'LIFESTYLE',
    'BUSINESS',
    'WEATHER',
  ];

  /**
   * Get trending/top apps (non-games) from Google Play Store
   */
  async getTrendingApps(count: number = 30): Promise<PlayStoreGame[]> {
    if (this.cachedTrendingApps.length > 0 && Date.now() - this.appsCacheTimestamp < this.cacheDuration) {
      console.log('📦 Using cached Play Store trending apps');
      return this.cachedTrendingApps.slice(0, count);
    }

    console.log('📱 Fetching trending apps from Google Play Store...');

    try {
      const allApps: PlayStoreGame[] = [];
      
      // Fetch from multiple collections to get diverse trending apps
      const collections = [
        gplayAny.collection.TOP_FREE,
        gplayAny.collection.TOP_PAID,
        gplayAny.collection.GROSSING,
      ];

      for (const collection of collections) {
        try {
          const apps = await gplay.list({
            collection,
            num: 50,
            fullDetail: false,
          });

          for (const app of apps) {
            // Filter out games - we only want non-game apps
            const appGenreId = (app as any).genreId || '';
            if (!appGenreId.startsWith('GAME') && !allApps.find((a: PlayStoreGame) => a.appId === app.appId)) {
              allApps.push(this.mapGameData(app));
            }
          }
        } catch (error: any) {
          console.log(`⚠️ Failed to fetch ${collection}: ${error.message}`);
        }
      }

      // Also fetch from specific app categories for variety
      const randomCategories = this.APP_CATEGORIES.sort(() => Math.random() - 0.5).slice(0, 8);
      for (const category of randomCategories) {
        try {
          const apps = await gplayAny.list({
            collection: gplayAny.collection.TOP_FREE,
            category,
            num: 25,
            fullDetail: false,
          });

          for (const app of apps) {
            const appGenreId = (app as any).genreId || '';
            if (!appGenreId.startsWith('GAME') && !allApps.find((a: PlayStoreGame) => a.appId === app.appId)) {
              allApps.push(this.mapGameData(app));
            }
          }
        } catch (error: any) {
          console.log(`⚠️ Failed to fetch category ${category}: ${error.message}`);
        }
      }

      // Sort by score and filter valid apps
      const MIN_RATING = 3.8;
      const MIN_INSTALLS = 1_000_000; // 1 million minimum for more variety
      
      this.cachedTrendingApps = allApps
        .filter(app => {
          const isNotGame = !app.genreId?.startsWith('GAME');
          const installCount = this.parseInstallCount(app.installs);
          const hasValidData = app.icon && app.title && app.score >= MIN_RATING && installCount >= MIN_INSTALLS;
          return isNotGame && hasValidData;
        })
        .sort((a, b) => b.score - a.score);
      
      this.appsCacheTimestamp = Date.now();
      console.log(`✅ Fetched ${this.cachedTrendingApps.length} trending apps from Play Store`);
      
      return this.cachedTrendingApps.slice(0, count);
    } catch (error: any) {
      console.error('❌ Failed to fetch trending apps:', error.message);
      return this.getFallbackApps();
    }
  }

  /**
   * Get a random trending app with full details - ensures variety by tracking used apps
   */
  async getRandomTrendingApp(): Promise<PlayStoreGame> {
    const trendingApps = await this.getTrendingApps(100);
    
    let availableApps: PlayStoreGame[];
    let isFallback = false;
    
    if (trendingApps.length === 0) {
      availableApps = this.getFallbackApps();
      isFallback = true;
      console.log(`📦 Using fallback apps (${availableApps.length} available)`);
    } else {
      availableApps = trendingApps;
    }

    // Filter out already used apps
    let unusedApps = availableApps.filter(app => !this.usedAppIds.has(app.appId));
    
    // If all apps have been used, force refresh from Google Play
    if (unusedApps.length === 0) {
      console.log('🔄 All apps have been used, forcing fresh fetch from Google Play...');
      this.usedAppIds.clear();
      this.appsCacheTimestamp = 0; // Force cache refresh
      this.cachedTrendingApps = []; // Clear cached apps
      
      // Fetch fresh apps from Google Play
      const freshApps = await this.getTrendingApps(100);
      if (freshApps.length > 0) {
        availableApps = freshApps;
        unusedApps = freshApps;
        console.log(`✅ Fetched ${freshApps.length} fresh apps from Google Play`);
      } else {
        unusedApps = availableApps;
      }
    }
    
    // Clear cache if it gets too large
    if (this.usedAppIds.size >= 100) {
      console.log('🔄 Used apps cache full, forcing fresh fetch...');
      this.usedAppIds.clear();
      this.appsCacheTimestamp = 0;
    }

    console.log(`🎲 Selecting from ${unusedApps.length} unused apps (${this.usedAppIds.size} already used)`);

    // Random selection from unused apps
    let selectedApp: PlayStoreGame;
    
    if (unusedApps.length === 1) {
      selectedApp = unusedApps[0];
    } else {
      const randomIndex = Math.floor(Math.random() * unusedApps.length);
      selectedApp = unusedApps[randomIndex];
    }

    // Track this app as used
    this.usedAppIds.add(selectedApp.appId);
    console.log(`✅ Selected app: ${selectedApp.title} (appId: ${selectedApp.appId})`);

    // Get full details for the selected app (only if not using fallback)
    if (!isFallback) {
      const details = await this.getAppDetails(selectedApp.appId);
      return details || selectedApp;
    }
    
    return selectedApp;
  }

  /**
   * Get detailed app information including screenshots
   */
  async getAppDetails(appId: string): Promise<PlayStoreGame | null> {
    console.log(`📖 Fetching app details for: ${appId}`);

    try {
      const details = await gplay.app({ appId });
      
      return {
        appId: details.appId,
        title: details.title,
        icon: details.icon,
        screenshots: details.screenshots || [],
        developer: details.developer,
        score: details.score || 0,
        scoreText: details.scoreText || '0',
        installs: details.installs || '0',
        genre: details.genre || 'App',
        genreId: details.genreId || 'APPLICATION',
        description: details.description || '',
        descriptionHTML: details.descriptionHTML || '',
        summary: details.summary || '',
        price: details.price || 0,
        free: details.free !== false,
        priceText: details.priceText || 'Free',
        currency: details.currency || 'USD',
        updated: details.updated,
        version: details.version,
        recentChanges: details.recentChanges,
        contentRating: details.contentRating,
        ratings: details.ratings,
        reviews: details.reviews,
        histogram: details.histogram,
        headerImage: details.headerImage,
        video: details.video,
        videoImage: details.videoImage,
      };
    } catch (error: any) {
      console.error(`❌ Failed to get app details for ${appId}:`, error.message);
      return null;
    }
  }

  /**
   * Fallback apps when API fails
   */
  private getFallbackApps(): PlayStoreGame[] {
    return [
      {
        appId: 'com.whatsapp',
        title: 'WhatsApp Messenger',
        icon: 'https://play-lh.googleusercontent.com/bYtqbOcTYOlgc6gqZ2rwb8lptHuwlNE75zYJu6Bn076-hTmvd96HH-6v7S0YUAAJXoJN=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/dT0HMLqPjxqKZSLl0D_L-a3fr0dXM0WxJiNgN8T6OGjJuEHhIGkQq7ZY0dE1JQGH1g=w1920'],
        developer: 'WhatsApp LLC',
        score: 4.3,
        scoreText: '4.3',
        installs: '5,000,000,000+',
        genre: 'Communication',
        genreId: 'COMMUNICATION',
        description: 'Simple. Reliable. Private. With end-to-end encryption, your personal messages and calls are secured.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.instagram.android',
        title: 'Instagram',
        icon: 'https://play-lh.googleusercontent.com/VRMWkE5p3CkWhJs6nv-9ZsLAs1QOg5ob1_3qg-rckwYW7yp1fMrYZqnEFpk0IoVP4LM=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/1yMsAuQ1nL7Fz0MWJrN9VjMNH3E_vB0FQxG4Fg3C0gp1u7QeQ0L1eQw3-D8B4cJw=w1920'],
        developer: 'Meta Platforms, Inc.',
        score: 4.1,
        scoreText: '4.1',
        installs: '2,000,000,000+',
        genre: 'Social',
        genreId: 'SOCIAL',
        description: 'Connect with friends, share what you\'re up to, or see what\'s new from others all over the world.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.facebook.katana',
        title: 'Facebook',
        icon: 'https://play-lh.googleusercontent.com/ccWDU4A7fX1R24v-vvT480ySh26AYp97g1VrIB_FIdjRcuQB2JP2WdY7h_wVVAeSpg=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/8B7xFxqDqUDDNc3-8_4BQkLbmX1XG7MQTE-1wP4_GQB_Q5vCzFGr8T-vO8_EQJB=w1920'],
        developer: 'Meta Platforms, Inc.',
        score: 4.0,
        scoreText: '4.0',
        installs: '5,000,000,000+',
        genre: 'Social',
        genreId: 'SOCIAL',
        description: 'Connect with friends and the world around you on Facebook.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.google.android.youtube',
        title: 'YouTube',
        icon: 'https://play-lh.googleusercontent.com/lMoItBgdPPVDJsNOVtP26EKHePkwBg-PkuY9NOrc-fumRtTFP4XhpUNk_22syN4Datc=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/vA4tG0v4aasE7oIvRIvTkOYTwom07oFN7k1Cb=w1920'],
        developer: 'Google LLC',
        score: 4.2,
        scoreText: '4.2',
        installs: '10,000,000,000+',
        genre: 'Video Players & Editors',
        genreId: 'VIDEO_PLAYERS',
        description: 'Enjoy your favorite videos and music, upload original content, and share it all with friends.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.spotify.music',
        title: 'Spotify',
        icon: 'https://play-lh.googleusercontent.com/UrY7BAZ-XfXGpfkeWg0zCCR-7FXeTL_WiQfT9F-bD-pCPvr0bD=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/SyPz_0E=w1920'],
        developer: 'Spotify AB',
        score: 4.4,
        scoreText: '4.4',
        installs: '1,000,000,000+',
        genre: 'Music & Audio',
        genreId: 'MUSIC_AND_AUDIO',
        description: 'Listen to music, play podcasts and discover new content with millions of tracks.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.snapchat.android',
        title: 'Snapchat',
        icon: 'https://play-lh.googleusercontent.com/KxeSAjPTKliCErbivNiXrd6cTwfbqUJcbSRPe_IBVK_YmwckfMRS1VIHz-5cgT09lQ=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/vVAa=w1920'],
        developer: 'Snap Inc',
        score: 4.0,
        scoreText: '4.0',
        installs: '1,000,000,000+',
        genre: 'Social',
        genreId: 'SOCIAL',
        description: 'Share the moment with friends and family.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.zhiliaoapp.musically',
        title: 'TikTok',
        icon: 'https://play-lh.googleusercontent.com/OS-MhZjHHDc5X1LP9wJoOp_VQn7CQVP0c=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/Qd8Q=w1920'],
        developer: 'TikTok Pte. Ltd.',
        score: 4.3,
        scoreText: '4.3',
        installs: '1,000,000,000+',
        genre: 'Social',
        genreId: 'SOCIAL',
        description: 'Discover short videos and create your own with music effects.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.twitter.android',
        title: 'X (Twitter)',
        icon: 'https://play-lh.googleusercontent.com/nQ6aGm4E=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/Qe9A=w1920'],
        developer: 'X Corp.',
        score: 3.9,
        scoreText: '3.9',
        installs: '1,000,000,000+',
        genre: 'News & Magazines',
        genreId: 'NEWS_AND_MAGAZINES',
        description: 'See what\'s happening in the world right now.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.google.android.apps.maps',
        title: 'Google Maps',
        icon: 'https://play-lh.googleusercontent.com/Kf8WTct65hFJxBUDm5E-EpYsiDoLQiGGbnuyP6HBNax43YShXti9THPon1YKB6zPYpA=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/MAP=w1920'],
        developer: 'Google LLC',
        score: 4.2,
        scoreText: '4.2',
        installs: '10,000,000,000+',
        genre: 'Travel & Local',
        genreId: 'TRAVEL_AND_LOCAL',
        description: 'Navigate your world faster and easier with Google Maps.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.netflix.mediaclient',
        title: 'Netflix',
        icon: 'https://play-lh.googleusercontent.com/TBRwjS_qfJCSj1m7zZB93FnpJM5fSpMA_wUlFDLxWAb45T9RmwBvQd5cWR5viJJOhkI=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/Netflix=w1920'],
        developer: 'Netflix, Inc.',
        score: 4.3,
        scoreText: '4.3',
        installs: '1,000,000,000+',
        genre: 'Entertainment',
        genreId: 'ENTERTAINMENT',
        description: 'Watch movies and TV shows recommended just for you.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'com.amazon.mShop.android.shopping',
        title: 'Amazon Shopping',
        icon: 'https://play-lh.googleusercontent.com/5ZLLe3=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/Amaz=w1920'],
        developer: 'Amazon Mobile LLC',
        score: 4.4,
        scoreText: '4.4',
        installs: '500,000,000+',
        genre: 'Shopping',
        genreId: 'SHOPPING',
        description: 'Shop millions of products, track orders and compare prices.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
      {
        appId: 'org.telegram.messenger',
        title: 'Telegram',
        icon: 'https://play-lh.googleusercontent.com/ZU9cSsyIJZo6Oy7HTHiEPwZg0m2Crep-d5ZrfajqtsH-qgUXSqKpNA2FpPDTn-7qA5Q=w512-h512',
        screenshots: ['https://play-lh.googleusercontent.com/Tele=w1920'],
        developer: 'Telegram FZ-LLC',
        score: 4.4,
        scoreText: '4.4',
        installs: '1,000,000,000+',
        genre: 'Communication',
        genreId: 'COMMUNICATION',
        description: 'Pure instant messaging — simple, fast, secure, and synced across all devices.',
        price: 0,
        free: true,
        priceText: 'Free',
        currency: 'USD',
      },
    ];
  }

  /**
   * Get Arabic genre name for apps
   */
  getAppGenreArabic(genre: string): string {
    const genreMap: Record<string, string> = {
      'Social': 'تواصل اجتماعي',
      'Communication': 'تواصل',
      'Productivity': 'إنتاجية',
      'Tools': 'أدوات',
      'Entertainment': 'ترفيه',
      'Photography': 'تصوير',
      'Video Players & Editors': 'فيديو',
      'Music & Audio': 'موسيقى وصوت',
      'Shopping': 'تسوق',
      'Finance': 'مالية',
      'Health & Fitness': 'صحة ولياقة',
      'Education': 'تعليم',
      'Travel & Local': 'سفر ومحلي',
      'News & Magazines': 'أخبار ومجلات',
      'Food & Drink': 'طعام وشراب',
      'Lifestyle': 'نمط حياة',
      'Business': 'أعمال',
      'Weather': 'طقس',
    };
    return genreMap[genre] || genre;
  }
}

export const googlePlayService = new GooglePlayService();
