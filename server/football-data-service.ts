import { firestoreService } from './firestore';

export interface FootballTeam {
  id: number;
  name: string;
  logo: string;
  country?: string;
}

export interface FootballMatch {
  id: number;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  league: {
    id: number;
    name: string;
    logo: string;
    country: string;
  };
  date: Date;
  venue?: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: {
    home: number;
    away: number;
  };
}

export interface TrendingMatch {
  match: FootballMatch;
  excitement: number;
  promotionalTextAr: string;
  promotionalTextEn: string;
}

const POPULAR_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 2, name: 'UEFA Champions League', country: 'Europe' },
  { id: 3, name: 'UEFA Europa League', country: 'Europe' },
  { id: 848, name: 'FIFA World Cup', country: 'World' },
  { id: 531, name: 'UEFA Super Cup', country: 'Europe' },
  { id: 1, name: 'FIFA World Cup', country: 'World' },
];

const TOP_TEAMS = [
  'Real Madrid', 'Barcelona', 'Manchester City', 'Liverpool', 'Bayern Munich',
  'Paris Saint-Germain', 'Manchester United', 'Chelsea', 'Arsenal', 'Juventus',
  'Inter Milan', 'AC Milan', 'Borussia Dortmund', 'Atletico Madrid', 'Napoli',
  'Tottenham', 'Newcastle', 'Aston Villa', 'Brighton', 'West Ham'
];

const EXCITING_DESCRIPTIONS_AR = [
  'مباراة نارية تنتظركم! لا تفوتوا هذه المواجهة التاريخية',
  'الديربي المرتقب! من سيفوز في هذه المعركة الحاسمة؟',
  'مواجهة العمالقة! استعدوا لـ 90 دقيقة من الإثارة',
  'قمة كروية لا تُنسى! شاهدوا أفضل اللاعبين في العالم',
  'الكلاسيكو الكبير! المجد ينتظر الفائز',
  'صراع الكبار! من سيحسم الموقعة الليلة؟',
  'لحظات تاريخية قادمة! لا تفوتوا هذه المباراة',
  'أقوى مواجهة في الموسم! الإثارة في أعلى مستوياتها',
];

const EXCITING_DESCRIPTIONS_EN = [
  'An epic clash awaits! Don\'t miss this historic showdown',
  'The awaited derby! Who will win this decisive battle?',
  'Clash of the titans! Get ready for 90 minutes of excitement',
  'An unforgettable football summit! Watch the world\'s best players',
  'The big classic! Glory awaits the winner',
  'Battle of giants! Who will settle it tonight?',
  'Historic moments coming! Don\'t miss this match',
  'The strongest match of the season! Excitement at its peak',
];

const WATCH_CTA_AR = [
  'شاهد المباراة مباشرة',
  'لا تفوت هذه المواجهة',
  'انضم لملايين المشاهدين',
  'موعد الإثارة الآن',
  'المجد ينتظر',
];

const WATCH_CTA_EN = [
  'WATCH LIVE NOW',
  'DON\'T MISS THIS MATCH',
  'JOIN MILLIONS OF VIEWERS',
  'THE EXCITEMENT STARTS NOW',
  'GLORY AWAITS',
];

export class FootballDataService {
  private rapidApiKey: string | null = null;

  async initialize(): Promise<void> {
    const config = await firestoreService.getAPIConfig('rapidapi');
    this.rapidApiKey = config?.apiKey || process.env.RAPIDAPI_KEY || null;
    
    if (this.rapidApiKey) {
      console.log('✅ RapidAPI key loaded for Football Data');
    } else {
      console.log('⚠️ RapidAPI key not configured - using simulated football data');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.rapidApiKey === null) {
      await this.initialize();
    }
  }

  async getTrendingMatches(): Promise<TrendingMatch[]> {
    await this.ensureInitialized();

    if (this.rapidApiKey) {
      const liveMatches = await this.fetchLiveMatches();
      if (liveMatches.length > 0) {
        return liveMatches;
      }
      
      const upcomingMatches = await this.getUpcomingMatches();
      if (upcomingMatches.length > 0) {
        return upcomingMatches;
      }
      
      return this.getSimulatedTrendingMatches();
    } else {
      return this.getSimulatedTrendingMatches();
    }
  }

  private async fetchLiveMatches(): Promise<TrendingMatch[]> {
    try {
      const response = await fetch('https://api-football-v1.p.rapidapi.com/v3/fixtures?live=all', {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey!,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        console.log('API-Football live matches request failed, will try upcoming matches');
        return [];
      }

      const data = await response.json();
      const matches: FootballMatch[] = (data.response || []).slice(0, 5).map((fixture: any) => ({
        id: fixture.fixture.id,
        homeTeam: {
          id: fixture.teams.home.id,
          name: fixture.teams.home.name,
          logo: fixture.teams.home.logo,
        },
        awayTeam: {
          id: fixture.teams.away.id,
          name: fixture.teams.away.name,
          logo: fixture.teams.away.logo,
        },
        league: {
          id: fixture.league.id,
          name: fixture.league.name,
          logo: fixture.league.logo,
          country: fixture.league.country,
        },
        date: new Date(fixture.fixture.date),
        venue: fixture.fixture.venue?.name,
        status: 'live',
        score: {
          home: fixture.goals.home || 0,
          away: fixture.goals.away || 0,
        },
      }));

      return matches.map(match => this.createTrendingMatch(match));
    } catch (error) {
      console.error('Error fetching live matches:', error);
      return [];
    }
  }

  private async getUpcomingMatches(): Promise<TrendingMatch[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const response = await fetch(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&status=NS`,
        {
          headers: {
            'X-RapidAPI-Key': this.rapidApiKey!,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        }
      );

      if (!response.ok) {
        console.log('API-Football upcoming matches request failed');
        return [];
      }

      const data = await response.json();
      const popularLeagueIds = POPULAR_LEAGUES.map(l => l.id);
      
      const matches: FootballMatch[] = (data.response || [])
        .filter((fixture: any) => popularLeagueIds.includes(fixture.league.id))
        .slice(0, 10)
        .map((fixture: any) => ({
          id: fixture.fixture.id,
          homeTeam: {
            id: fixture.teams.home.id,
            name: fixture.teams.home.name,
            logo: fixture.teams.home.logo,
          },
          awayTeam: {
            id: fixture.teams.away.id,
            name: fixture.teams.away.name,
            logo: fixture.teams.away.logo,
          },
          league: {
            id: fixture.league.id,
            name: fixture.league.name,
            logo: fixture.league.logo,
            country: fixture.league.country,
          },
          date: new Date(fixture.fixture.date),
          venue: fixture.fixture.venue?.name,
          status: 'scheduled',
        }));

      return matches.map(match => this.createTrendingMatch(match));
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      return [];
    }
  }

  private getSimulatedTrendingMatches(): TrendingMatch[] {
    const simulatedMatches: FootballMatch[] = [
      {
        id: 1,
        homeTeam: { 
          id: 541, 
          name: 'Real Madrid', 
          logo: 'https://media.api-sports.io/football/teams/541.png' 
        },
        awayTeam: { 
          id: 529, 
          name: 'Barcelona', 
          logo: 'https://media.api-sports.io/football/teams/529.png' 
        },
        league: { 
          id: 140, 
          name: 'La Liga', 
          logo: 'https://media.api-sports.io/football/leagues/140.png',
          country: 'Spain' 
        },
        date: new Date(Date.now() + 3600000),
        venue: 'Santiago Bernabéu',
        status: 'scheduled',
      },
      {
        id: 2,
        homeTeam: { 
          id: 50, 
          name: 'Manchester City', 
          logo: 'https://media.api-sports.io/football/teams/50.png' 
        },
        awayTeam: { 
          id: 40, 
          name: 'Liverpool', 
          logo: 'https://media.api-sports.io/football/teams/40.png' 
        },
        league: { 
          id: 39, 
          name: 'Premier League', 
          logo: 'https://media.api-sports.io/football/leagues/39.png',
          country: 'England' 
        },
        date: new Date(Date.now() + 7200000),
        venue: 'Etihad Stadium',
        status: 'scheduled',
      },
      {
        id: 3,
        homeTeam: { 
          id: 157, 
          name: 'Bayern Munich', 
          logo: 'https://media.api-sports.io/football/teams/157.png' 
        },
        awayTeam: { 
          id: 165, 
          name: 'Borussia Dortmund', 
          logo: 'https://media.api-sports.io/football/teams/165.png' 
        },
        league: { 
          id: 78, 
          name: 'Bundesliga', 
          logo: 'https://media.api-sports.io/football/leagues/78.png',
          country: 'Germany' 
        },
        date: new Date(Date.now() + 10800000),
        venue: 'Allianz Arena',
        status: 'scheduled',
      },
      {
        id: 4,
        homeTeam: { 
          id: 85, 
          name: 'Paris Saint-Germain', 
          logo: 'https://media.api-sports.io/football/teams/85.png' 
        },
        awayTeam: { 
          id: 541, 
          name: 'Real Madrid', 
          logo: 'https://media.api-sports.io/football/teams/541.png' 
        },
        league: { 
          id: 2, 
          name: 'UEFA Champions League', 
          logo: 'https://media.api-sports.io/football/leagues/2.png',
          country: 'Europe' 
        },
        date: new Date(Date.now() + 14400000),
        venue: 'Parc des Princes',
        status: 'scheduled',
      },
      {
        id: 5,
        homeTeam: { 
          id: 42, 
          name: 'Arsenal', 
          logo: 'https://media.api-sports.io/football/teams/42.png' 
        },
        awayTeam: { 
          id: 47, 
          name: 'Tottenham', 
          logo: 'https://media.api-sports.io/football/teams/47.png' 
        },
        league: { 
          id: 39, 
          name: 'Premier League', 
          logo: 'https://media.api-sports.io/football/leagues/39.png',
          country: 'England' 
        },
        date: new Date(Date.now() + 18000000),
        venue: 'Emirates Stadium',
        status: 'scheduled',
      },
    ];

    const randomIndex = Math.floor(Math.random() * simulatedMatches.length);
    return [this.createTrendingMatch(simulatedMatches[randomIndex])];
  }

  private createTrendingMatch(match: FootballMatch): TrendingMatch {
    const isTopTeamMatch = 
      TOP_TEAMS.includes(match.homeTeam.name) && TOP_TEAMS.includes(match.awayTeam.name);
    
    const excitement = isTopTeamMatch ? 95 : 75 + Math.floor(Math.random() * 20);
    
    const descIndex = Math.floor(Math.random() * EXCITING_DESCRIPTIONS_AR.length);
    const ctaIndex = Math.floor(Math.random() * WATCH_CTA_AR.length);
    
    return {
      match,
      excitement,
      promotionalTextAr: `${EXCITING_DESCRIPTIONS_AR[descIndex]}\n\n${WATCH_CTA_AR[ctaIndex]}`,
      promotionalTextEn: `${EXCITING_DESCRIPTIONS_EN[descIndex]}\n\n${WATCH_CTA_EN[ctaIndex]}`,
    };
  }

  async getRandomTrendingMatch(): Promise<TrendingMatch> {
    const matches = await this.getTrendingMatches();
    
    if (matches.length === 0) {
      const simulated = this.getSimulatedTrendingMatches();
      return simulated[0];
    }
    
    matches.sort((a, b) => b.excitement - a.excitement);
    
    const randomIndex = Math.floor(Math.random() * Math.min(3, matches.length));
    return matches[randomIndex];
  }

  generateMatchTitle(match: FootballMatch): { titleAr: string; titleEn: string } {
    const titleEn = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const titleAr = `${match.homeTeam.name} ضد ${match.awayTeam.name}`;
    return { titleAr, titleEn };
  }

  getMatchTimeFormatted(match: FootballMatch): { timeAr: string; timeEn: string } {
    const matchDate = new Date(match.date);
    const now = new Date();
    const diffMs = matchDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffMs < 0) {
      return { timeAr: 'جارية الآن', timeEn: 'LIVE NOW' };
    } else if (diffHours < 1) {
      return { 
        timeAr: `تبدأ خلال ${diffMins} دقيقة`, 
        timeEn: `STARTS IN ${diffMins} MIN` 
      };
    } else if (diffHours < 24) {
      return { 
        timeAr: `تبدأ خلال ${diffHours} ساعة`, 
        timeEn: `STARTS IN ${diffHours}H` 
      };
    } else {
      const dateStr = matchDate.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' });
      return { 
        timeAr: dateStr, 
        timeEn: matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) 
      };
    }
  }
}

export const footballDataService = new FootballDataService();
