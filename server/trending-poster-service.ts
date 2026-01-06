import { googleTrendsService, TrendQueryResult } from './google-trends';
import { PosterImageMetadata, ErrorResponse, googleImageSearchService } from './google-image-search';
import { r2Storage } from './r2-storage';
import { firestoreService } from './firestore';
import { translateToArabic, generatePromotionalDescription, generatePosterContent, generateCategoryImagePrompt, PosterContent, deepseekSDK } from './deepseek';
import { footballDataService, TrendingMatch, FootballMatch } from './football-data-service';
import { huggingFaceSDK } from './huggingface';
import { googlePlayService, PlayStoreGame } from './google-play-service';
import type { storyCategories } from '@shared/schema';
import sharp from 'sharp';

function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface TMDBVideoResult {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TrendingPosterResult {
  pngUrl: string;
  webpUrl: string;
  facebookPngUrl: string;
  instagramPngUrl: string;
  tiktokWebpUrl: string;
  trendingTopic: string;
  posterTitle: string;
  latestEpisode?: number;
  sourceImageUrl: string;
  metadata: PosterImageMetadata;
  trailerUrl?: string;
  trailerKey?: string;
  trailerName?: string;
  originCountry?: string;
  tmdbId?: number;
  descriptionAr?: string;
  descriptionEn?: string;
  voteAverage?: number;
}

export interface StoryScheduleItem {
  platform: string;
  imageFormat: string;
  scheduledFor: Date;
  imageUrl: string;
  category: string;
  trendingTerm: string;
  episodeNumber?: number;
}

interface PosterSearchResult {
  imageUrl: string;
  title: string;
  source: string;
}

interface TMDBTrendingResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  origin_country?: string[];
}

interface InternationalTVRegion {
  countryCode: string;
  languageCode: string;
  name: string;
}

const INTERNATIONAL_TV_REGIONS: InternationalTVRegion[] = [
  { countryCode: 'TR', languageCode: 'tr', name: 'Turkish' },
  { countryCode: 'US', languageCode: 'en', name: 'American' },
  { countryCode: 'IN', languageCode: 'hi', name: 'Indian' },
  { countryCode: 'KR', languageCode: 'ko', name: 'Korean' },
];

interface TMDBTVDetails {
  id: number;
  name: string;
  poster_path: string | null;
  last_episode_to_air?: {
    id: number;
    episode_number: number;
    season_number: number;
    name: string;
    overview?: string;
  };
  number_of_episodes?: number;
  number_of_seasons?: number;
}

interface TMDBEpisodeDetails {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date?: string;
}

const CATEGORY_SEARCH_QUERIES: Record<typeof storyCategories[number], string[]> = {
  'movies': ['movie poster', 'film poster', 'cinema poster'],
  'tv_shows': ['TV series poster', 'show poster', 'drama poster'],
  'sports': ['football match stadium', 'soccer game atmosphere', 'champions league match', 'premier league football'],
  'recipes': ['delicious food photography', 'gourmet dish presentation', 'homemade recipe photo', 'professional food styling'],
  'gaming': ['official game poster logo 4K', 'video game cover art HD logo', 'AAA game key art official', 'game poster trending logo HD'],
  'apps': ['app store icon HD', 'mobile app logo official', 'app interface premium design', 'smartphone app icon'],
  'tv_channels': ['TV channel logo HD', 'broadcast network logo', 'television channel branding', 'media network logo'],
};

const RECIPE_PROMOTIONAL_AR = [
  'وصفة شهية ومميزة ستجعل عائلتك تطلبها مراراً وتكراراً! مكونات بسيطة متوفرة في كل بيت ونتيجة مذهلة تفوق كل التوقعات. رائحة تملأ المكان بالشهية وطعم لذيذ لا يُقاوم. جربها الآن واستمتع بألذ طعم ستتذوقه في حياتك!',
  'طبق رائع يستحق التجربة ويجعلك تشعر وكأنك في أفضل المطاعم! سهل التحضير وسريع ولا يحتاج لخبرة طبخ مسبقة. المقادير الدقيقة والخطوات المفصلة بانتظارك الآن. لا تفوت هذه الوصفة الاستثنائية التي ستغير مائدتك للأفضل!',
  'وصفة خاصة ستبهر عائلتك وأصدقائك في كل مناسبة وتجعلك نجم السهرة! سر الطعم اللذيذ في التفاصيل الصغيرة التي نكشفها لك. مذاق استثنائي ومظهر احترافي يليق بأرقى المناسبات. اكتشف الوصفة الكاملة الآن وأبهر الجميع!',
  'من أشهى الأطباق التي ستتذوقها في حياتك بدون مبالغة! الوصفة الكاملة بالمقادير المضبوطة والخطوات التفصيلية جاهزة لك. طريقة التحضير سهلة والنتيجة مضمونة ومبهرة. ابدأ التحضير الآن وحضّر أطيب وجبة لعائلتك!',
  'طبق لذيذ جاهز في دقائق معدودة يجعلك تستمتع بوقتك بدل قضائه في المطبخ! اكتشف السر وراء هذا الطعم الرائع الذي يحبه الجميع. المكونات متوفرة في كل سوبرماركت والخطوات سهلة جداً ومضمونة النتيجة. جربها الآن!',
  'وصفة مميزة من المطبخ العالمي ستغير نظرتك للطبخ وتجعلك تعشق المطبخ! مذاق استثنائي لا يُنسى ومظهر احترافي كأنك في مطعم فاخر. تعلم أسرار الشيفات المحترفين بسهولة تامة. الوصفة الكاملة بانتظارك!',
];

const RECIPE_PROMOTIONAL_EN = [
  'A delicious and special recipe that will make your family ask for it again and again! Simple ingredients available in every home with amazing results that exceed all expectations. An aroma that fills the place with appetite and an irresistible delicious taste. Try it now and enjoy the tastiest flavor you\'ll ever have!',
  'An amazing dish worth trying that makes you feel like you\'re at the best restaurant! Easy to prepare and quick, no previous cooking experience needed. Exact measurements and detailed steps await you now. Don\'t miss this exceptional recipe that will transform your table for the better!',
  'A special recipe that will impress your family and friends on every occasion and make you the star of the evening! The secret of delicious taste is in the small details we reveal to you. Exceptional taste and professional look worthy of the finest occasions. Discover the full recipe now and amaze everyone!',
  'One of the tastiest dishes you\'ll ever try in your life, without exaggeration! The complete recipe with exact measurements and detailed steps ready for you. The preparation method is easy and the result is guaranteed and impressive. Start cooking now and prepare the tastiest meal for your family!',
  'Delicious dish ready in just minutes, letting you enjoy your time instead of spending it in the kitchen! Discover the secret behind this amazing taste that everyone loves. Ingredients available at every supermarket and steps are very easy with guaranteed results. Try it now!',
  'A special recipe from world cuisine that will change your view of cooking and make you love the kitchen! An unforgettable exceptional taste and professional look like you\'re at a luxury restaurant. Learn the secrets of professional chefs with complete ease. The full recipe awaits you!',
];

const RECIPE_CTA_AR = 'اكتشف الوصفة السرية الكاملة الآن';
const RECIPE_CTA_EN = 'DISCOVER THE FULL SECRET RECIPE NOW';

const GAMING_PROMOTIONAL_AR = [
  'احصل على سكينات وكوينز مجانية بدون أي اشتراك أو دفع! طريقة حصرية ومضمونة 100% للحصول على آلاف الكوينز والسكينات النادرة. ملايين اللاعبين استفادوا من هذا العرض المذهل. اسحب للأعلى الآن واحصل على مكافآتك فوراً!',
  'عرض محدود جداً! سكينات نادرة وكوينز غير محدودة بدون اشتراك ولا بطاقة ائتمان! طريقة سرية يستخدمها المحترفون للحصول على أفضل المظاهر والعملات. لا تضيع هذه الفرصة الذهبية واسحب للأعلى الآن!',
  'الطريقة الوحيدة للحصول على سكينات وكوينز مجاناً بالكامل! بدون تسجيل بطاقات، بدون اشتراكات، بدون رسوم خفية. اكتشف السر الذي أخفته عنك الشركات واحصل على آلاف المكافآت فوراً. اسحب للأعلى!',
  'كوينز غير محدودة + سكينات أسطورية نادرة = مجاناً تماماً! عرض خاص لفترة محدودة جداً للحصول على أندر العناصر في اللعبة. لا يحتاج اشتراك ولا دفع أي مبلغ. اسحب للأعلى الآن قبل انتهاء العرض!',
  'أخيراً طريقة حقيقية للحصول على سكينات وكوينز بدون دفع فلس واحد! مضمونة 100% ومجربة من ملايين اللاعبين حول العالم. احصل على أفضل المظاهر والعملات مجاناً تماماً. اسحب للأعلى واستمتع!',
  'سكينات حصرية + كوينز لا نهائية = بدون أي اشتراك! الطريقة الأسهل والأسرع للحصول على كل ما تريده في اللعبة مجاناً. ملايين اللاعبين يثقون بهذه الطريقة المضمونة. اسحب للأعلى الآن!',
];

const GAMING_PROMOTIONAL_EN = [
  'Get FREE skins and coins with NO subscription required! Exclusive guaranteed method to get thousands of rare skins and coins. Millions of players have benefited from this amazing offer. Swipe up now and get your rewards instantly!',
  'Limited time offer! Rare skins and unlimited coins with NO subscription, NO credit card! Secret method used by pros to get the best looks and currency. Don\'t miss this golden opportunity - swipe up now!',
  'The ONLY way to get skins and coins completely FREE! No card registration, no subscriptions, no hidden fees. Discover the secret that companies have been hiding and get thousands of rewards instantly. Swipe up!',
  'Unlimited coins + Legendary rare skins = Completely FREE! Special limited-time offer to get the rarest items in the game. No subscription needed, no payment required. Swipe up now before the offer ends!',
  'Finally a REAL way to get skins and coins without paying a single cent! 100% guaranteed and tested by millions of players worldwide. Get the best looks and currency for FREE. Swipe up and enjoy!',
  'Exclusive skins + Infinite coins = NO subscription needed! The easiest and fastest way to get everything you want in the game for FREE. Millions of players trust this guaranteed method. Swipe up now!',
];

const GAMING_CTA_AR = 'اسحب للأعلى واحصل على Skins و Coins مجاناً';
const GAMING_CTA_EN = 'SWIPE UP - FREE SKINS & COINS';

const APPS_PROMOTIONAL_AR = [
  'تطبيق مميز سيغير طريقة حياتك بالكامل ويجعل كل شيء أسهل وأسرع! مصمم بعناية فائقة لتجربة مستخدم استثنائية لا مثيل لها. ملايين المستخدمين حول العالم يعتمدون عليه يومياً في مهامهم. حمّله الآن واستمتع بالنسخة المدفوعة مجاناً لفترة محدودة!',
  'التطبيق الأكثر تحميلاً في العالم الآن ولسبب وجيه جداً! ملايين المستخدمين يثقون به ويوصون به لأصدقائهم وعائلاتهم. تصميم عصري أنيق وسرعة فائقة في الأداء بدون أي مشاكل. جربه مجاناً واكتشف السبب بنفسك الآن!',
  'حمّل الآن واحصل على Premium كامل مجاناً لفترة محدودة جداً! تصميم أنيق وعصري وميزات لا حصر لها تجعل حياتك أسهل. تطبيق ذكي يفهم احتياجاتك ويتعلم من استخدامك ليقدم تجربة مخصصة. لا تضيع هذه الفرصة الذهبية!',
  'التطبيق الذي كنت تبحث عنه طوال حياتك وأخيراً وجدته! سهل الاستخدام جداً ومليء بالمميزات الاحترافية القوية. انضم لملايين المستخدمين السعداء الذين غيّر هذا التطبيق حياتهم للأفضل. حمّله الآن ولن تندم أبداً!',
  'اكتشف لماذا أصبح التطبيق الأول في فئته والأكثر تحميلاً في جميع المتاجر! تحديثات مستمرة ودعم فني متميز على مدار الساعة. ميزات جديدة تُضاف أسبوعياً لتحسين تجربتك باستمرار. ابدأ تجربتك المجانية الآن!',
  'تطبيق يوفر وقتك ويسهّل حياتك بشكل لا يصدق ويجعلك أكثر إنتاجية! تقنيات ذكية متقدمة ومميزات حصرية لن تجدها في أي مكان آخر. واجهة مستخدم بديهية وتصميم راقي يناسب الجميع. احصل على النسخة المدفوعة مجاناً الآن!',
];

const APPS_PROMOTIONAL_EN = [
  'An amazing app that will completely change your lifestyle and make everything easier and faster! Carefully designed for an exceptional user experience like no other. Millions of users worldwide rely on it daily for their tasks. Download now and enjoy the premium version free for a limited time!',
  'The most downloaded app in the world right now and for very good reason! Millions of users trust it and recommend it to their friends and family. Modern elegant design and super-fast performance without any issues. Try it for free and discover why yourself now!',
  'Download now and get complete Premium for FREE for a very limited time! Elegant modern design and endless features that make your life easier. A smart app that understands your needs and learns from your usage to provide a customized experience. Don\'t miss this golden opportunity!',
  'The app you\'ve been searching for your whole life and finally found it! Very easy to use and packed with powerful professional features. Join millions of happy users whose lives this app has changed for the better. Download now and you\'ll never regret it!',
  'Discover why it became the number one app in its category and the most downloaded in all stores! Continuous updates and excellent 24/7 support. New features added weekly to continuously improve your experience. Start your free trial now!',
  'An app that saves your time and simplifies your life incredibly and makes you more productive! Advanced smart technologies and exclusive features you won\'t find anywhere else. Intuitive user interface and elegant design suitable for everyone. Get the premium version free now!',
];

const APPS_CTA_AR = 'إسحب للأعلى واحصل على اشتراك بريميوم 12 شهراً مجاناً';
const APPS_CTA_EN = 'SWIPE UP & GET 12 MONTHS PREMIUM FREE';

const TV_CHANNELS_PROMOTIONAL_AR = [
  'قناة مميزة تقدم أفضل المحتوى الحصري والبرامج المتنوعة على مدار الساعة! بث مباشر بجودة فائقة HD وبدون أي انقطاع. برامج ترفيهية ومسلسلات حصرية ومحتوى عائلي يناسب الجميع. شاهد البث المباشر الآن مجاناً!',
  'انضم لملايين المشاهدين الذين يستمتعون بهذه القناة الرائعة يومياً! محتوى متجدد ومتنوع يناسب جميع الأذواق والأعمار. أفلام حصرية ومسلسلات جديدة وبرامج ترفيهية لا تفوّت. شاهد البث المباشر بجودة عالية الآن!',
  'قناة البرامج الحصرية والمحتوى المميز الذي لن تجده في أي مكان آخر! بث مستمر 24/7 بأعلى جودة صوت وصورة. برامج منوعة تناسب الكبار والصغار والعائلة بأكملها. اشترك الآن واستمتع بعرض مجاني خاص!',
  'أفضل قناة ترفيهية تقدم محتوى عربي وعالمي متميز بجودة استثنائية! مسلسلات تركية ومصرية وخليجية حصرية. أفلام جديدة وبرامج متنوعة وأخبار على مدار الساعة. لا تفوت مشاهدة البث المباشر الآن!',
  'قناة تجمع بين الترفيه والمعلومة في محتوى ممتع وراقي! برامج ثقافية وترفيهية ووثائقية تناسب الجميع. بث حي ومباشر بجودة 4K فائقة الوضوح. شاهد المحتوى الحصري الآن واستمتع بتجربة فريدة!',
  'قناتك المفضلة لمتابعة أحدث البرامج والمسلسلات العالمية! محتوى جديد يُضاف يومياً ليبقيك متابعاً لكل جديد. جودة بث عالية وتجربة مشاهدة ممتازة بدون إعلانات. اشترك الآن واحصل على شهر مجاناً!',
];

const TV_CHANNELS_PROMOTIONAL_EN = [
  'An amazing channel offering the best exclusive content and diverse programs around the clock! Live streaming in super HD quality without any interruption. Entertainment shows, exclusive series, and family content suitable for everyone. Watch the live broadcast now for free!',
  'Join millions of viewers who enjoy this amazing channel daily! Fresh and diverse content suitable for all tastes and ages. Exclusive movies, new series, and entertainment programs you can\'t miss. Watch the live broadcast in high quality now!',
  'The channel for exclusive programs and premium content you won\'t find anywhere else! Continuous 24/7 broadcast in the highest audio and video quality. Variety shows suitable for adults, kids, and the whole family. Subscribe now and enjoy a special free offer!',
  'The best entertainment channel offering distinguished Arabic and international content in exceptional quality! Exclusive Turkish, Egyptian, and Gulf series. New movies, variety shows, and 24/7 news. Don\'t miss watching the live broadcast now!',
  'A channel that combines entertainment and information in enjoyable and elegant content! Cultural, entertainment, and documentary programs suitable for everyone. Live broadcast in ultra-clear 4K quality. Watch the exclusive content now and enjoy a unique experience!',
  'Your favorite channel to follow the latest global programs and series! New content added daily to keep you updated on everything new. High broadcast quality and excellent viewing experience without ads. Subscribe now and get a month free!',
];

const TV_CHANNELS_CTA_AR = 'شاهد البث المباشر الآن مجاناً';
const TV_CHANNELS_CTA_EN = 'WATCH LIVE BROADCAST FREE NOW';

const STORY_DIMENSIONS = {
  width: 1080,
  height: 1920,
};

export class TrendingPosterService {
  private tmdbApiKey: string | null = null;
  private generatedTmdbIds: Set<number> = new Set();
  private maxGeneratedIdsCache = 100;

  private excitingDescriptions = {
    'movies': [
      'Now Streaming Worldwide',
      'The Blockbuster Everyone Is Talking About',
      'Experience Cinema at Its Finest',
      'A Masterpiece You Cannot Miss',
      'Breaking Box Office Records',
      'Critics Are Calling It Phenomenal',
      'The Most Anticipated Film of the Year',
      'Pure Cinematic Excellence',
      'A Story That Will Stay With You Forever',
      'This Is What Cinema Was Made For',
      'Prepare to Be Amazed',
      'An Unforgettable Experience Awaits',
    ],
    'tv_shows': [
      'Now Streaming Worldwide',
      'The Series Everyone Is Binge-Watching',
      'Television at Its Absolute Best',
      'Your New Obsession Starts Now',
      'The Show Breaking All Records',
      'Critics Are Calling It Must-Watch TV',
      'The Most Talked About Series',
      'Get Ready for Epic Entertainment',
      'Every Episode Will Leave You Breathless',
      'The Phenomenon That Took Over',
      'Prepare for Plot Twists You Will Never Forget',
      'This Is Peak Television',
    ],
  };

  private getRandomExcitingDescription(category: 'movies' | 'tv_shows'): string {
    const descriptions = this.excitingDescriptions[category];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private translateToEnglish(arabicTitle: string): string {
    const arabicToEnglishMap: Record<string, string> = {
      'الأفلام': 'Movies',
      'المسلسلات': 'Series',
      'الترند': 'Trending',
    };
    
    for (const [ar, en] of Object.entries(arabicToEnglishMap)) {
      if (arabicTitle.includes(ar)) {
        return arabicTitle.replace(ar, en);
      }
    }
    
    return arabicTitle;
  }

  async initialize() {
    const tmdbConfig = await firestoreService.getAPIConfig('tmdb');
    if (tmdbConfig?.apiKey) {
      this.tmdbApiKey = tmdbConfig.apiKey;
      console.log('✅ TMDB API key loaded from Firestore config');
    } else if (process.env.TMDB_API_KEY) {
      this.tmdbApiKey = process.env.TMDB_API_KEY;
      console.log('✅ TMDB API key loaded from environment');
    } else {
      console.warn('⚠️ TMDB API key not configured - Movies and TV shows will require TMDB API key');
    }

    await googleImageSearchService.initialize();
    console.log('✅ Google Image Search service initialized');
  }

  async generateTrendingPoster(category: typeof storyCategories[number]): Promise<TrendingPosterResult> {
    console.log(`🎬 Generating trending poster for category: ${category}`);

    await this.initialize();

    if (category === 'movies' || category === 'tv_shows') {
      return this.generateTMDBTrendingPoster(category);
    } else if (category === 'sports') {
      return this.generateFootballMatchPoster();
    } else if (category === 'recipes') {
      return this.generateRecipePoster();
    } else if (category === 'gaming') {
      return this.generateGamingPoster();
    } else if (category === 'apps') {
      return this.generateAppPoster();
    } else if (category === 'tv_channels') {
      return this.generateTVChannelsPoster();
    } else {
      return this.generateGoogleSearchTrendingPoster(category);
    }
  }

  private async generateTMDBTrendingPoster(category: 'movies' | 'tv_shows'): Promise<TrendingPosterResult> {
    if (!this.tmdbApiKey) {
      throw new Error('مفتاح TMDB API غير مُعدّ. يرجى إضافة مفتاح TMDB في إعدادات API لاستخدام فئات الأفلام والمسلسلات.');
    }

    let validResults: TMDBTrendingResult[] = [];
    
    if (category === 'tv_shows') {
      console.log(`🌍 Fetching international TV shows (US, Turkish, Korean, Indian)...`);
      validResults = await this.getInternationalTVShows();
      validResults = validResults.filter((item) => item.poster_path);
    } else {
      validResults = await this.getTrendingMoviesWithFallback();
    }
    
    if (validResults.length === 0) {
      throw new Error('لم يتم العثور على بوسترات في نتائج TMDB');
    }

    const uniqueResults = validResults.filter(item => !this.generatedTmdbIds.has(item.id));
    
    let selectedItem: TMDBTrendingResult;
    if (uniqueResults.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(10, uniqueResults.length));
      selectedItem = uniqueResults[randomIndex];
    } else {
      console.log('⚠️ All trending content already generated, clearing cache and selecting new...');
      this.generatedTmdbIds.clear();
      const randomIndex = Math.floor(Math.random() * Math.min(10, validResults.length));
      selectedItem = validResults[randomIndex];
    }
    
    this.generatedTmdbIds.add(selectedItem.id);
    if (this.generatedTmdbIds.size > this.maxGeneratedIdsCache) {
      const firstId = this.generatedTmdbIds.values().next().value;
      if (firstId !== undefined) {
        this.generatedTmdbIds.delete(firstId);
      }
    }
    
    const title = selectedItem.title || selectedItem.name || 'Unknown';
    const tmdbImageUrl = `https://image.tmdb.org/t/p/w780${selectedItem.poster_path}`;
    const originCountry = selectedItem.origin_country?.[0] || 'US';
    
    console.log(`✅ Selected trending ${category}: "${title}" (ID: ${selectedItem.id}, Origin: ${originCountry}, Rating: ${selectedItem.vote_average})`);

    let descriptionAr: string;
    let descriptionEn: string;
    let latestEpisode: number | undefined;
    let latestSeasonNumber: number | undefined;

    if (category === 'tv_shows' && selectedItem.id) {
      const details = await this.getTVShowDetails(selectedItem.id);
      if (details?.last_episode_to_air) {
        latestEpisode = details.last_episode_to_air.episode_number;
        latestSeasonNumber = details.last_episode_to_air.season_number;
        console.log(`📺 Latest episode: S${latestSeasonNumber}E${latestEpisode}`);
        
        const episodeDescriptions = await this.getEpisodeBilingualDescription(
          selectedItem.id,
          latestSeasonNumber,
          latestEpisode,
          details.last_episode_to_air.overview || selectedItem.overview
        );
        descriptionAr = episodeDescriptions.descriptionAr;
        descriptionEn = episodeDescriptions.descriptionEn;
        console.log(`📝 Using episode-specific description for poster`);
      } else {
        const generalDescriptions = await this.getBilingualDescription(
          selectedItem.id,
          'tv',
          selectedItem.overview
        );
        descriptionAr = generalDescriptions.descriptionAr;
        descriptionEn = generalDescriptions.descriptionEn;
      }
    } else {
      const generalDescriptions = await this.getBilingualDescription(
        selectedItem.id,
        category === 'movies' ? 'movie' : 'tv',
        selectedItem.overview
      );
      descriptionAr = generalDescriptions.descriptionAr;
      descriptionEn = generalDescriptions.descriptionEn;
    }

    const trailer = await this.getTrailerVideo(
      selectedItem.id, 
      category === 'movies' ? 'movie' : 'tv'
    );

    const imageBuffer = await this.downloadImage(tmdbImageUrl);
    
    const processedImages = await this.processImageForStories(
      imageBuffer,
      title,
      category,
      latestEpisode,
      descriptionEn,
      descriptionAr
    );

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/${category}/${timestamp}-${randomId}`;

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(processedImages.pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category, topic: title, source: 'tmdb', originCountry },
      }),
      r2Storage.uploadFile(processedImages.webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category, topic: title, source: 'tmdb', originCountry },
      }),
      r2Storage.uploadFile(processedImages.facebookPngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category, topic: title, platform: 'facebook', source: 'tmdb', originCountry },
      }),
      r2Storage.uploadFile(processedImages.instagramPngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category, topic: title, platform: 'instagram', source: 'tmdb', originCountry },
      }),
      r2Storage.uploadFile(processedImages.tiktokWebpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category, topic: title, platform: 'tiktok', source: 'tmdb', originCountry },
      }),
    ]);

    console.log(`✅ TMDB poster uploaded successfully to R2`);
    if (trailer) {
      console.log(`🎬 Trailer available: ${trailer.url}`);
    }

    const metadata: PosterImageMetadata = {
      category,
      trendingTerm: title,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic: title,
      posterTitle: title,
      latestEpisode,
      sourceImageUrl: tmdbImageUrl,
      metadata,
      trailerUrl: trailer?.url,
      trailerKey: trailer?.key,
      trailerName: trailer?.name,
      originCountry,
      tmdbId: selectedItem.id,
      descriptionAr,
      descriptionEn,
      voteAverage: selectedItem.vote_average,
    };
  }

  private async getTrendingMoviesWithFallback(): Promise<TMDBTrendingResult[]> {
    if (!this.tmdbApiKey) return [];

    console.log(`🔥 Fetching TMDB trending movies...`);
    
    const trendingUrl = `https://api.themoviedb.org/3/trending/movie/day?api_key=${this.tmdbApiKey}&language=en-US`;
    
    const response = await fetch(trendingUrl);
    if (!response.ok) {
      throw new Error(`خطأ في TMDB API: ${response.statusText}`);
    }

    const data = await response.json();
    let trendingResults: TMDBTrendingResult[] = (data.results || []).filter((item: TMDBTrendingResult) => item.poster_path);
    
    console.log(`📊 Found ${trendingResults.length} trending movies`);
    
    const uniqueTrending = trendingResults.filter(item => !this.generatedTmdbIds.has(item.id));
    
    if (uniqueTrending.length >= 5) {
      return trendingResults;
    }
    
    console.log(`⚡ Trending exhausted, fetching high-rated movies with box office history...`);
    
    const regions = ['US', 'TR', 'IN', 'KR'];
    const highRatedResults: TMDBTrendingResult[] = [];
    
    for (const region of regions) {
      try {
        const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${this.tmdbApiKey}&language=en-US&sort_by=popularity.desc&vote_average.gte=7.5&vote_count.gte=500&with_origin_country=${region}&with_release_type=2|3&page=1`;
        
        const discoverResponse = await fetch(discoverUrl);
        if (discoverResponse.ok) {
          const discoverData = await discoverResponse.json();
          const regionMovies = (discoverData.results || []).slice(0, 5).map((movie: TMDBTrendingResult) => ({
            ...movie,
            origin_country: [region],
          }));
          highRatedResults.push(...regionMovies);
          console.log(`✅ Found ${regionMovies.length} high-rated movies from ${region}`);
        }
      } catch (error) {
        console.error(`Error fetching ${region} movies:`, error);
      }
    }
    
    highRatedResults.sort((a, b) => b.vote_average - a.vote_average);
    
    const allResults = [...trendingResults, ...highRatedResults];
    const uniqueResults = allResults.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    );
    
    console.log(`📚 Total unique movies available: ${uniqueResults.length}`);
    
    return uniqueResults;
  }

  private async getBilingualDescription(
    mediaId: number, 
    mediaType: 'movie' | 'tv',
    fallbackOverview?: string,
    title?: string
  ): Promise<{ descriptionAr: string; descriptionEn: string }> {
    if (!this.tmdbApiKey) {
      return {
        descriptionAr: 'وصف غير متوفر',
        descriptionEn: fallbackOverview || 'Description not available',
      };
    }

    try {
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      
      const [enResponse, arResponse] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/${endpoint}/${mediaId}?api_key=${this.tmdbApiKey}&language=en-US`),
        fetch(`https://api.themoviedb.org/3/${endpoint}/${mediaId}?api_key=${this.tmdbApiKey}&language=ar-SA`),
      ]);

      let descriptionEn = fallbackOverview || 'Description not available';
      let descriptionAr = '';
      let hasArabicFromTMDB = false;

      if (enResponse.ok) {
        const enData = await enResponse.json();
        descriptionEn = enData.overview || enData.tagline || fallbackOverview || 'Description not available';
        console.log(`📄 English description from TMDB: "${descriptionEn.substring(0, 50)}..."`);
      }

      if (arResponse.ok) {
        const arData = await arResponse.json();
        const arOverview = arData.overview || arData.tagline || '';
        
        if (arOverview && arOverview.trim().length > 10 && arOverview !== descriptionEn) {
          descriptionAr = arOverview;
          hasArabicFromTMDB = true;
          console.log(`🇸🇦 Arabic description from TMDB: "${descriptionAr.substring(0, 50)}..."`);
        }
      }

      if (!hasArabicFromTMDB && descriptionEn && descriptionEn !== 'Description not available') {
        console.log(`🌐 No Arabic from TMDB, using AI translation...`);
        try {
          descriptionAr = await translateToArabic(descriptionEn);
          console.log(`✅ AI translated Arabic: "${descriptionAr.substring(0, 50)}..."`);
        } catch (translationError) {
          console.error('AI translation failed, using fallback:', translationError);
          descriptionAr = this.getDefaultArabicDescription(mediaType);
        }
      }

      if (!descriptionAr || descriptionAr.length < 10) {
        descriptionAr = this.getDefaultArabicDescription(mediaType);
      }

      console.log(`📝 Final bilingual descriptions for ${mediaType} ID: ${mediaId}`);
      console.log(`   AR: "${descriptionAr.substring(0, 60)}..."`);
      console.log(`   EN: "${descriptionEn.substring(0, 60)}..."`);
      
      return { descriptionAr, descriptionEn };
    } catch (error) {
      console.error('Error fetching bilingual descriptions:', error);
      return {
        descriptionAr: this.getDefaultArabicDescription(mediaType),
        descriptionEn: fallbackOverview || 'Description not available',
      };
    }
  }

  private getDefaultArabicDescription(mediaType: 'movie' | 'tv'): string {
    const defaults = {
      movie: 'فيلم رائع يستحق المشاهدة! لا تفوت هذه التحفة السينمائية المذهلة',
      tv: 'مسلسل مثير ومشوق! تابع أحداثه الرائعة ولا تفوت أي حلقة',
    };
    return defaults[mediaType];
  }

  private async getTVShowDetails(tvId: number): Promise<TMDBTVDetails | null> {
    if (!this.tmdbApiKey) return null;

    try {
      const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${this.tmdbApiKey}&language=en-US`;
      const response = await fetch(url);
      
      if (!response.ok) return null;
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching TV show details:', error);
      return null;
    }
  }

  private async getEpisodeBilingualDescription(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    fallbackOverview?: string
  ): Promise<{ descriptionAr: string; descriptionEn: string }> {
    if (!this.tmdbApiKey) {
      return {
        descriptionAr: this.getDefaultArabicDescription('tv'),
        descriptionEn: fallbackOverview || 'Description not available',
      };
    }

    try {
      const [enResponse, arResponse] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${this.tmdbApiKey}&language=en-US`),
        fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${this.tmdbApiKey}&language=ar-SA`),
      ]);

      let descriptionEn = fallbackOverview || 'Description not available';
      let descriptionAr = '';
      let episodeName = '';
      let hasArabicFromTMDB = false;

      if (enResponse.ok) {
        const enData = await enResponse.json() as TMDBEpisodeDetails;
        if (enData.overview && enData.overview.trim()) {
          descriptionEn = enData.overview;
        }
        episodeName = enData.name || '';
        console.log(`📄 Episode EN description: "${descriptionEn.substring(0, 50)}..."`);
      }

      if (arResponse.ok) {
        const arData = await arResponse.json() as TMDBEpisodeDetails;
        const arOverview = arData.overview || '';
        
        if (arOverview && arOverview.trim().length > 10 && arOverview !== descriptionEn) {
          descriptionAr = arOverview;
          hasArabicFromTMDB = true;
          console.log(`🇸🇦 Episode AR description from TMDB: "${descriptionAr.substring(0, 50)}..."`);
        }
      }

      if (!hasArabicFromTMDB && descriptionEn && descriptionEn !== 'Description not available') {
        console.log(`🌐 No Arabic episode description from TMDB, using AI translation...`);
        try {
          descriptionAr = await translateToArabic(descriptionEn);
          console.log(`✅ AI translated episode AR: "${descriptionAr.substring(0, 50)}..."`);
        } catch (translationError) {
          console.error('AI episode translation failed:', translationError);
          descriptionAr = this.getDefaultArabicDescription('tv');
        }
      }

      if (!descriptionAr || descriptionAr.length < 10) {
        descriptionAr = this.getDefaultArabicDescription('tv');
      }

      console.log(`📺 Final episode ${seasonNumber}x${episodeNumber} bilingual descriptions for TV ID: ${tvId}`);
      console.log(`   Episode name: "${episodeName}"`);
      console.log(`   AR: "${descriptionAr.substring(0, 60)}..."`);
      console.log(`   EN: "${descriptionEn.substring(0, 60)}..."`);
      
      return { descriptionAr, descriptionEn };
    } catch (error) {
      console.error('Error fetching episode bilingual descriptions:', error);
      return {
        descriptionAr: this.getDefaultArabicDescription('tv'),
        descriptionEn: fallbackOverview || 'Description not available',
      };
    }
  }

  private async getTrailerVideo(mediaId: number, mediaType: 'movie' | 'tv'): Promise<{ url: string; key: string; name: string } | null> {
    if (!this.tmdbApiKey) return null;

    try {
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const url = `https://api.themoviedb.org/3/${endpoint}/${mediaId}/videos?api_key=${this.tmdbApiKey}&language=en-US`;
      
      console.log(`🎬 Fetching trailer for ${mediaType} ID: ${mediaId}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`⚠️ Failed to fetch videos: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      const videos: TMDBVideoResult[] = data.results || [];

      const trailer = videos.find(
        (v) => v.type === 'Trailer' && v.site === 'YouTube' && v.official
      ) || videos.find(
        (v) => v.type === 'Trailer' && v.site === 'YouTube'
      ) || videos.find(
        (v) => v.type === 'Teaser' && v.site === 'YouTube'
      ) || videos.find(
        (v) => v.site === 'YouTube'
      );

      if (trailer) {
        const youtubeUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
        console.log(`✅ Found trailer: "${trailer.name}" - ${youtubeUrl}`);
        return {
          url: youtubeUrl,
          key: trailer.key,
          name: trailer.name,
        };
      }

      console.log(`⚠️ No trailer found for ${mediaType} ID: ${mediaId}`);
      return null;
    } catch (error) {
      console.error('Error fetching trailer:', error);
      return null;
    }
  }

  private async getInternationalTVShows(): Promise<TMDBTrendingResult[]> {
    if (!this.tmdbApiKey) return [];

    const allShows: TMDBTrendingResult[] = [];
    
    console.log(`🌍 Fetching international TV shows from multiple regions...`);

    for (const region of INTERNATIONAL_TV_REGIONS) {
      try {
        const url = `https://api.themoviedb.org/3/discover/tv?api_key=${this.tmdbApiKey}&language=en-US&sort_by=popularity.desc&with_origin_country=${region.countryCode}&with_original_language=${region.languageCode}&vote_count.gte=50&first_air_date.gte=2020-01-01&page=1`;
        
        console.log(`🔍 Fetching ${region.name} TV shows...`);
        
        const response = await fetch(url);
        if (!response.ok) {
          console.log(`⚠️ Failed to fetch ${region.name} shows: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const shows = (data.results || []).slice(0, 5).map((show: TMDBTrendingResult) => ({
          ...show,
          origin_country: [region.countryCode],
        }));
        
        console.log(`✅ Found ${shows.length} ${region.name} TV shows`);
        allShows.push(...shows);
      } catch (error) {
        console.error(`Error fetching ${region.name} shows:`, error);
      }
    }

    allShows.sort((a, b) => b.vote_average - a.vote_average);
    
    console.log(`📺 Total international shows collected: ${allShows.length}`);
    return allShows;
  }

  private async generateGoogleSearchTrendingPoster(category: typeof storyCategories[number]): Promise<TrendingPosterResult> {
    const trendResult = await googleTrendsService.getBestTrendForCategory(category);
    const trendingTopic = trendResult.trendingTerm;
    
    console.log(`🔥 Trending topic for ${category}: ${trendingTopic}`);

    const categoryQueries = CATEGORY_SEARCH_QUERIES[category];
    const searchQuery = `${trendingTopic} ${categoryQueries[Math.floor(Math.random() * categoryQueries.length)]}`;
    
    console.log(`🔍 Searching Google Images for: "${searchQuery}"`);

    const imageResult = await googleImageSearchService.searchThumbnailImage(searchQuery, category);
    
    if (!imageResult) {
      console.log(`⚠️ No images found with trending query, trying category fallback...`);
      const fallbackQuery = categoryQueries[Math.floor(Math.random() * categoryQueries.length)];
      const fallbackResult = await googleImageSearchService.searchThumbnailImage(fallbackQuery, category);
      
      if (!fallbackResult) {
        throw new Error(`لم يتم العثور على صور مناسبة لفئة ${category}`);
      }
      
      console.log(`✅ Found image with fallback query`);
    }

    const finalImageResult = imageResult || await googleImageSearchService.searchThumbnailImage(categoryQueries[0], category);
    
    if (!finalImageResult) {
      throw new Error(`لم يتم العثور على صور مناسبة لفئة ${category}`);
    }

    const imageUrl = finalImageResult.imageUrl;
    const title = finalImageResult.title || trendingTopic;
    
    console.log(`✅ Selected Google image: "${title.substring(0, 50)}..."`);

    const imageBuffer = await this.downloadImage(imageUrl);
    
    const processedImages = await this.processImageForStories(
      imageBuffer,
      trendingTopic,
      category
    );

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/${category}/${timestamp}-${randomId}`;

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(processedImages.pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category, topic: trendingTopic, source: 'google' },
      }),
      r2Storage.uploadFile(processedImages.webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category, topic: trendingTopic, source: 'google' },
      }),
      r2Storage.uploadFile(processedImages.facebookPngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category, topic: trendingTopic, platform: 'facebook', source: 'google' },
      }),
      r2Storage.uploadFile(processedImages.instagramPngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category, topic: trendingTopic, platform: 'instagram', source: 'google' },
      }),
      r2Storage.uploadFile(processedImages.tiktokWebpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category, topic: trendingTopic, platform: 'tiktok', source: 'google' },
      }),
    ]);

    console.log(`✅ Google Image poster uploaded successfully to R2`);

    const metadata: PosterImageMetadata = {
      category,
      trendingTerm: trendingTopic,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic,
      posterTitle: trendingTopic,
      sourceImageUrl: imageUrl,
      metadata,
    };
  }

  private async generateFootballMatchPoster(): Promise<TrendingPosterResult> {
    console.log('⚽ Generating Football Match Poster...');
    
    await footballDataService.initialize();
    const trendingMatch = await footballDataService.getRandomTrendingMatch();
    const match = trendingMatch.match;
    
    const { titleAr, titleEn } = footballDataService.generateMatchTitle(match);
    const { timeAr, timeEn } = footballDataService.getMatchTimeFormatted(match);
    
    console.log(`⚽ Selected match: ${titleEn}`);
    console.log(`   League: ${match.league.name}`);
    console.log(`   Time: ${timeEn}`);
    
    const categoryQueries = CATEGORY_SEARCH_QUERIES['sports'];
    const searchQuery = `${match.homeTeam.name} vs ${match.awayTeam.name} football match`;
    
    let imageResult = await googleImageSearchService.searchThumbnailImage(searchQuery, 'sports');
    
    if (!imageResult) {
      console.log('⚠️ No specific match image, using stadium fallback...');
      imageResult = await googleImageSearchService.searchThumbnailImage(
        `${match.league.name} football stadium atmosphere`,
        'sports'
      );
    }

    if (!imageResult) {
      imageResult = await googleImageSearchService.searchThumbnailImage(categoryQueries[0], 'sports');
    }

    if (!imageResult) {
      throw new Error('لم يتم العثور على صور مناسبة للمباراة');
    }

    const imageBuffer = await this.downloadImage(imageResult.imageUrl);
    
    const processedImage = await this.createFootballMatchOverlay(
      imageBuffer,
      match,
      trendingMatch.promotionalTextAr,
      trendingMatch.promotionalTextEn,
      timeAr,
      timeEn
    );

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/sports/${timestamp}-${randomId}`;

    const [pngBuffer, webpBuffer] = await Promise.all([
      sharp(processedImage).png({ quality: 95 }).toBuffer(),
      sharp(processedImage).webp({ quality: 90 }).toBuffer(),
    ]);

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category: 'sports', topic: titleEn, source: 'football' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'sports', topic: titleEn, source: 'football' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category: 'sports', topic: titleEn, platform: 'facebook', source: 'football' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category: 'sports', topic: titleEn, platform: 'instagram', source: 'football' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'sports', topic: titleEn, platform: 'tiktok', source: 'football' },
      }),
    ]);

    console.log(`✅ Football match poster uploaded successfully`);

    const metadata: PosterImageMetadata = {
      category: 'sports',
      trendingTerm: titleEn,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic: titleEn,
      posterTitle: titleEn,
      sourceImageUrl: imageResult.imageUrl,
      metadata,
      descriptionAr: trendingMatch.promotionalTextAr,
      descriptionEn: trendingMatch.promotionalTextEn,
    };
  }

  private async downloadTeamLogo(logoUrl: string): Promise<string | null> {
    try {
      if (!logoUrl || !logoUrl.startsWith('http')) {
        return null;
      }
      
      const response = await fetch(logoUrl);
      if (!response.ok) {
        console.log(`⚠️ Failed to download logo from ${logoUrl}`);
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const resizedLogo = await sharp(buffer)
        .resize(140, 140, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      
      const base64 = resizedLogo.toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error(`Error downloading team logo: ${error}`);
      return null;
    }
  }

  private async createFootballMatchOverlay(
    imageBuffer: Buffer,
    match: FootballMatch,
    promoAr: string,
    promoEn: string,
    timeAr: string,
    timeEn: string
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    const resizedImage = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .toBuffer();

    const promoArLines = this.wrapText(promoAr.split('\n')[0] || promoAr, 35);
    const promoEnLines = this.wrapText(promoEn.split('\n')[0] || promoEn, 42);

    console.log(`🔄 Downloading team logos for ${match.homeTeam.name} vs ${match.awayTeam.name}...`);
    const [homeLogoBase64, awayLogoBase64, leagueLogoBase64] = await Promise.all([
      this.downloadTeamLogo(match.homeTeam.logo),
      this.downloadTeamLogo(match.awayTeam.logo),
      this.downloadTeamLogo(match.league.logo),
    ]);

    const homeLogoElement = homeLogoBase64 
      ? `<image x="${width / 4 - 70}" y="150" width="140" height="140" href="${homeLogoBase64}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="${width / 4}" cy="220" r="70" fill="white" filter="url(#shadow)"/>`;

    const awayLogoElement = awayLogoBase64
      ? `<image x="${width * 3 / 4 - 70}" y="150" width="140" height="140" href="${awayLogoBase64}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="${width * 3 / 4}" cy="220" r="70" fill="white" filter="url(#shadow)"/>`;

    const leagueLogoElement = leagueLogoBase64
      ? `<image x="${width / 2 - 25}" y="38" width="50" height="50" href="${leagueLogoBase64}" preserveAspectRatio="xMidYMid meet"/>`
      : '';

    console.log(`✅ Team logos loaded: Home=${!!homeLogoBase64}, Away=${!!awayLogoBase64}, League=${!!leagueLogoBase64}`);

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
            <stop offset="60%" style="stop-color:rgba(0,0,0,0.7);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="30%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            <stop offset="60%" style="stop-color:rgba(0,0,0,0.85);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="vsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="logoShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.8)"/>
          </filter>
          <clipPath id="circleClipHome">
            <circle cx="${width / 4}" cy="220" r="70"/>
          </clipPath>
          <clipPath id="circleClipAway">
            <circle cx="${width * 3 / 4}" cy="220" r="70"/>
          </clipPath>
        </defs>
        
        <!-- Top gradient for header area -->
        <rect x="0" y="0" width="${width}" height="550" fill="url(#topGrad)"/>
        
        <!-- Bottom gradient for CTA area -->
        <rect x="0" y="${height - 650}" width="${width}" height="650" fill="url(#bottomGrad)"/>
        
        <!-- LIVE Badge -->
        <rect x="${width / 2 - 60}" y="30" width="120" height="36" rx="18" fill="url(#redGrad)" filter="url(#shadow)"/>
        <circle cx="${width / 2 - 35}" cy="48" r="6" fill="white">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="${width / 2 + 10}" y="56" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">
          LIVE
        </text>
        
        <!-- League Badge with Logo -->
        <rect x="${width / 2 - 180}" y="80" width="360" height="55" rx="27" fill="url(#greenGrad)" filter="url(#shadow)"/>
        ${leagueLogoElement ? `<g transform="translate(${width / 2 - 160}, 82)">
          <circle cx="25" cy="27" r="24" fill="white"/>
          <image x="2" y="4" width="46" height="46" href="${leagueLogoBase64}" preserveAspectRatio="xMidYMid meet"/>
        </g>` : ''}
        <text x="${width / 2 + (leagueLogoElement ? 15 : 0)}" y="115" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          ${match.league.name}
        </text>
        
        <!-- Match Time Badge -->
        <rect x="${width / 2 - 140}" y="150" width="280" height="45" rx="22" fill="rgba(255,255,255,0.2)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="180" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle">
          ${timeEn}
        </text>
        
        <!-- Home Team with Logo -->
        <g transform="translate(0, 0)">
          <circle cx="${width / 4}" cy="290" r="85" fill="white" filter="url(#logoShadow)"/>
          <circle cx="${width / 4}" cy="290" r="80" fill="white"/>
          ${homeLogoBase64 ? `<image x="${width / 4 - 70}" y="220" width="140" height="140" href="${homeLogoBase64}" preserveAspectRatio="xMidYMid meet"/>` : ''}
          <text x="${width / 4}" y="400" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
            ${match.homeTeam.name.length > 14 ? match.homeTeam.name.substring(0, 14) + '...' : match.homeTeam.name}
          </text>
        </g>
        
        <!-- VS Badge -->
        <rect x="${width / 2 - 55}" y="265" width="110" height="65" rx="32" fill="url(#vsGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="308" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          VS
        </text>
        
        <!-- Away Team with Logo -->
        <g transform="translate(0, 0)">
          <circle cx="${width * 3 / 4}" cy="290" r="85" fill="white" filter="url(#logoShadow)"/>
          <circle cx="${width * 3 / 4}" cy="290" r="80" fill="white"/>
          ${awayLogoBase64 ? `<image x="${width * 3 / 4 - 70}" y="220" width="140" height="140" href="${awayLogoBase64}" preserveAspectRatio="xMidYMid meet"/>` : ''}
          <text x="${width * 3 / 4}" y="400" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
            ${match.awayTeam.name.length > 14 ? match.awayTeam.name.substring(0, 14) + '...' : match.awayTeam.name}
          </text>
        </g>
        
        <!-- Match Title Arabic -->
        <text x="${width / 2}" y="470" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${match.homeTeam.name} ضد ${match.awayTeam.name}
        </text>
        
        <!-- Arabic Promotional Text -->
        <rect x="50" y="${height - 480}" width="${width - 100}" height="${promoArLines.length * 44 + 35}" rx="22" fill="rgba(5,150,105,0.95)" filter="url(#shadow)"/>
        ${promoArLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 450 + (index * 44)}" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text -->
        ${promoEnLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 310 + (index * 38)}" font-family="Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.95)" text-anchor="middle" font-style="italic">
          "${line}"
        </text>
        `).join('')}
        
        <!-- Watch CTA Button -->
        <rect x="${width / 2 - 200}" y="${height - 140}" width="400" height="110" rx="22" fill="url(#greenGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${height - 95}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          شاهد المباراة مباشرة
        </text>
        <text x="${width / 2}" y="${height - 55}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">
          WATCH LIVE NOW
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    return await sharp(resizedImage)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .toBuffer();
  }

  private async generateRecipePoster(): Promise<TrendingPosterResult> {
    console.log('🍳 Generating Recipe Poster...');
    
    const trendResult = await googleTrendsService.getBestTrendForCategory('recipes');
    const trendingTopic = trendResult.trendingTerm;
    
    console.log(`🍳 Trending recipe topic: ${trendingTopic}`);
    
    const categoryQueries = CATEGORY_SEARCH_QUERIES['recipes'];
    const searchQuery = `${trendingTopic} ${categoryQueries[Math.floor(Math.random() * categoryQueries.length)]}`;
    
    let imageResult = await googleImageSearchService.searchThumbnailImage(searchQuery, 'recipes');
    
    if (!imageResult) {
      imageResult = await googleImageSearchService.searchThumbnailImage(categoryQueries[0], 'recipes');
    }

    if (!imageResult) {
      throw new Error('لم يتم العثور على صور مناسبة للوصفة');
    }

    const promoArIndex = Math.floor(Math.random() * RECIPE_PROMOTIONAL_AR.length);
    const promoAr = RECIPE_PROMOTIONAL_AR[promoArIndex];
    const promoEn = RECIPE_PROMOTIONAL_EN[promoArIndex];

    const imageBuffer = await this.downloadImage(imageResult.imageUrl);
    
    const processedImage = await this.createRecipeOverlay(
      imageBuffer,
      trendingTopic,
      promoAr,
      promoEn
    );

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/recipes/${timestamp}-${randomId}`;

    const [pngBuffer, webpBuffer] = await Promise.all([
      sharp(processedImage).png({ quality: 95 }).toBuffer(),
      sharp(processedImage).webp({ quality: 90 }).toBuffer(),
    ]);

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category: 'recipes', topic: trendingTopic, source: 'google' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'recipes', topic: trendingTopic, source: 'google' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category: 'recipes', topic: trendingTopic, platform: 'facebook', source: 'google' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category: 'recipes', topic: trendingTopic, platform: 'instagram', source: 'google' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'recipes', topic: trendingTopic, platform: 'tiktok', source: 'google' },
      }),
    ]);

    console.log(`✅ Recipe poster uploaded successfully`);

    const metadata: PosterImageMetadata = {
      category: 'recipes',
      trendingTerm: trendingTopic,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic,
      posterTitle: trendingTopic,
      sourceImageUrl: imageResult.imageUrl,
      metadata,
      descriptionAr: promoAr,
      descriptionEn: promoEn,
    };
  }

  private async createRecipeOverlay(
    imageBuffer: Buffer,
    recipeName: string,
    promoAr: string,
    promoEn: string
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    const resizedImage = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .toBuffer();

    const nameLines = this.wrapText(recipeName, 18, 3).map(line => escapeXml(line));
    const promoArLines = this.wrapText(promoAr, 28, 4).map(line => escapeXml(line));
    const promoEnLines = this.wrapText(promoEn, 35, 4).map(line => escapeXml(line));

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="20%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.85);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ea580c;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f97316;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="warmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#b91c1c;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#dc2626;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ea580c;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="titleGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Top gradient for header -->
        <rect x="0" y="0" width="${width}" height="500" fill="url(#topGrad)"/>
        
        <!-- Bottom gradient for content - Extended for 4 lines -->
        <rect x="0" y="${height - 750}" width="${width}" height="750" fill="url(#bottomGrad)"/>
        
        <!-- TRENDING Badge -->
        <rect x="${width / 2 - 100}" y="30" width="200" height="38" rx="19" fill="url(#goldGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="55" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">
          TRENDING RECIPE
        </text>
        
        <!-- Chef Hat Icon Badge -->
        <rect x="${width / 2 - 140}" y="80" width="280" height="55" rx="27" fill="url(#redGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="117" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          وصفة ترند اليوم
        </text>
        
        <!-- Recipe Name with prominent display -->
        <rect x="35" y="155" width="${width - 70}" height="${nameLines.length * 60 + 40}" rx="18" fill="rgba(0,0,0,0.7)" filter="url(#shadow)"/>
        ${nameLines.map((line, index) => `
        <text x="${width / 2}" y="${200 + (index * 60)}" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle" filter="url(#titleGlow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- Arabic Recipe Label -->
        <rect x="${width / 2 - 90}" y="${210 + (nameLines.length * 60)}" width="180" height="45" rx="22" fill="url(#orangeGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${240 + (nameLines.length * 60)}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          وصفة شهية
        </text>
        
        <!-- Arabic Promotional Text - 4 Lines (raised by 170px) -->
        <rect x="35" y="${height - 770}" width="${width - 70}" height="${promoArLines.length * 42 + 45}" rx="22" fill="rgba(234,88,12,0.95)" filter="url(#shadow)"/>
        ${promoArLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 735 + (index * 42)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text - 4 Lines (raised by 170px) -->
        ${promoEnLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 550 + (index * 38)}" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.95)" text-anchor="middle" font-style="italic">
          "${line}"
        </text>
        `).join('')}
        
        <!-- Professional CTA Button - Positioned higher for Facebook Story visibility (raised by 170px) -->
        <rect x="${width / 2 - 240}" y="${height - 450}" width="480" height="135" rx="25" fill="url(#warmGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${height - 393}" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${RECIPE_CTA_AR}
        </text>
        <text x="${width / 2}" y="${height - 345}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">
          ${RECIPE_CTA_EN}
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    return await sharp(resizedImage)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .toBuffer();
  }

  private async generateGamingPoster(): Promise<TrendingPosterResult> {
    console.log('🎮 Generating Gaming Poster from Google Play Store...');
    
    // Get trending game from Google Play Store
    const trendingGame = await googlePlayService.getRandomTrendingGame();
    const gameName = trendingGame.title;
    const gameGenre = trendingGame.genre;
    const gameGenreAr = googlePlayService.getGenreArabic(gameGenre);
    const installsInfo = googlePlayService.formatInstalls(trendingGame.installs);
    
    console.log(`🎮 Selected trending game from Play Store: ${gameName}`);
    console.log(`   Genre: ${gameGenre} (${gameGenreAr})`);
    console.log(`   Rating: ${trendingGame.score}/5`);
    console.log(`   Installs: ${trendingGame.installs}`);
    console.log(`   Developer: ${trendingGame.developer}`);
    
    let imageBuffer: Buffer | null = null;
    let usedImageUrl: string = '';
    let gameLogoBase64: string | null = null;
    
    // Fetch game icon (logo) and screenshot in parallel from Play Store
    const [logoResult, screenshotResult] = await Promise.all([
      this.fetchPlayStoreGameIcon(trendingGame),
      this.fetchPlayStoreScreenshot(trendingGame),
    ]);
    
    gameLogoBase64 = logoResult;
    
    if (screenshotResult) {
      imageBuffer = screenshotResult.buffer;
      usedImageUrl = screenshotResult.url;
      console.log(`✅ Successfully downloaded Play Store screenshot`);
    }
    
    // If no screenshot, try to use the icon as background with blur effect
    if (!imageBuffer && trendingGame.icon) {
      try {
        console.log(`🖼️ Using game icon as background...`);
        const iconUrl = googlePlayService.getHighResIcon(trendingGame.icon);
        const iconBuffer = await this.downloadImage(iconUrl);
        // Create blurred background from icon
        imageBuffer = await sharp(iconBuffer)
          .resize(STORY_DIMENSIONS.width, STORY_DIMENSIONS.height, { fit: 'cover' })
          .blur(15)
          .modulate({ brightness: 0.5 })
          .toBuffer();
        usedImageUrl = iconUrl;
      } catch (error: any) {
        console.log(`⚠️ Icon background failed: ${error.message}`);
      }
    }
    
    if (!imageBuffer) {
      console.log('📸 All images failed, using generated placeholder');
      imageBuffer = await this.generatePlaceholderImage(gameName, 'gaming');
      usedImageUrl = 'generated-placeholder';
    }

    console.log(`🤖 Generating professional bilingual descriptions for: ${gameName}`);
    let promoAr: string;
    let promoEn: string;
    
    try {
      const posterContent = await this.generatePlayStoreGameDescription(trendingGame);
      promoAr = posterContent.descriptionAr;
      promoEn = posterContent.descriptionEn;
      console.log(`✅ AI descriptions generated with game name: ${gameName}`);
    } catch (error) {
      console.log(`⚠️ AI generation failed, using template descriptions for: ${gameName}`);
      const ratingText = trendingGame.score > 4 ? 'استثنائية' : trendingGame.score > 3.5 ? 'ممتازة' : 'رائعة';
      promoAr = `${gameName} - اللعبة ${ratingText} الأكثر تحميلاً على متجر بلاي! ${installsInfo.ar}. تقييم ${trendingGame.score}/5 من ملايين اللاعبين. استمتع بتجربة ${gameGenreAr} لا مثيل لها مع رسومات خيالية ومستويات مثيرة. من تطوير ${trendingGame.developer}. حمّل ${gameName} مجاناً الآن!`;
      promoEn = `${gameName} - The top-rated ${gameGenre} game on Google Play! ${installsInfo.en}. Rated ${trendingGame.score}/5 by millions of players worldwide. Experience unmatched ${gameGenre} gameplay with stunning graphics and exciting challenges. Developed by ${trendingGame.developer}. Download ${gameName} FREE today!`;
    }
    
    const validImageBuffer: Buffer = imageBuffer;
    
    let processedImage: Buffer;
    try {
      processedImage = await this.createGamingOverlay(
        validImageBuffer,
        gameName,
        promoAr,
        promoEn,
        gameLogoBase64
      );
    } catch (overlayError: any) {
      console.log(`⚠️ Gaming overlay failed: ${overlayError.message}, using enhanced fallback`);
      processedImage = await this.createSimpleGamingFallback(
        validImageBuffer,
        gameName,
        promoAr,
        promoEn,
        gameLogoBase64
      );
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/gaming/${timestamp}-${randomId}`;

    const [pngBuffer, webpBuffer] = await Promise.all([
      sharp(processedImage).png({ quality: 95 }).toBuffer(),
      sharp(processedImage).webp({ quality: 90 }).toBuffer(),
    ]);

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category: 'gaming', topic: gameName, source: 'google-play' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'gaming', topic: gameName, source: 'google-play' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category: 'gaming', topic: gameName, platform: 'facebook', source: 'google-play' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category: 'gaming', topic: gameName, platform: 'instagram', source: 'google-play' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'gaming', topic: gameName, platform: 'tiktok', source: 'google-play' },
      }),
    ]);

    console.log(`✅ Gaming poster for "${gameName}" uploaded successfully (source: Google Play Store)`);

    const metadata: PosterImageMetadata = {
      category: 'gaming',
      trendingTerm: gameName,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic: gameName,
      posterTitle: gameName,
      sourceImageUrl: usedImageUrl,
      metadata,
      descriptionAr: promoAr,
      descriptionEn: promoEn,
      voteAverage: trendingGame.score,
    };
  }

  /**
   * Fetch and process game icon from Google Play Store with multiple fallbacks
   */
  private async fetchPlayStoreGameIcon(game: PlayStoreGame): Promise<string | null> {
    try {
      console.log(`🎮 Downloading official game icon for: ${game.title}`);
      
      // First, try to get fresh game details from Google Play API
      let iconUrl = game.icon;
      let freshGame: PlayStoreGame | null = null;
      
      if (!iconUrl || iconUrl.includes('undefined')) {
        console.log(`   🔄 No icon URL, fetching fresh data for: ${game.appId}`);
        freshGame = await googlePlayService.getGameDetails(game.appId);
        if (freshGame?.icon) {
          iconUrl = freshGame.icon;
          console.log(`   ✅ Got fresh icon URL from API`);
        }
      }
      
      if (!iconUrl) {
        console.log('⚠️ No game icon available for:', game.title);
        return null;
      }

      // Try multiple icon URL variants for better success rate
      const iconUrls = [
        googlePlayService.getHighResIcon(iconUrl),
        iconUrl.replace(/=w\d+-h\d+/g, '=w256-h256'),
        iconUrl.replace(/=w\d+-h\d+/g, '=w128-h128'),
        iconUrl,
      ];

      let buffer: Buffer | null = null;
      
      for (const url of iconUrls) {
        try {
          console.log(`   Trying icon URL: ${url.substring(0, 80)}...`);
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://play.google.com/',
            },
            signal: AbortSignal.timeout(10000),
          });

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > 1000) {
              buffer = Buffer.from(arrayBuffer);
              console.log(`   ✅ Icon downloaded: ${buffer.length} bytes`);
              break;
            }
          }
        } catch (e: any) {
          console.log(`   ⚠️ Icon URL failed: ${e.message}`);
        }
      }

      // If all URLs failed, try fetching fresh data from API and retry
      if (!buffer && !freshGame) {
        console.log(`   🔄 All URLs failed, fetching fresh game data from API...`);
        freshGame = await googlePlayService.getGameDetails(game.appId);
        if (freshGame?.icon && freshGame.icon !== iconUrl) {
          console.log(`   ✅ Got fresh icon URL, retrying...`);
          const freshUrls = [
            googlePlayService.getHighResIcon(freshGame.icon),
            freshGame.icon,
          ];
          
          for (const url of freshUrls) {
            try {
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                  'Referer': 'https://play.google.com/',
                },
                signal: AbortSignal.timeout(10000),
              });

              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength > 1000) {
                  buffer = Buffer.from(arrayBuffer);
                  console.log(`   ✅ Fresh icon downloaded: ${buffer.length} bytes`);
                  break;
                }
              }
            } catch (e: any) {
              console.log(`   ⚠️ Fresh icon URL failed: ${e.message}`);
            }
          }
        }
      }

      if (!buffer) {
        console.log(`❌ All icon URLs failed for: ${game.title}`);
        return null;
      }

      // Resize icon for poster use with transparent/original background
      const resizedIcon = await sharp(buffer)
        .resize(160, 160, { 
          fit: 'contain', 
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 100 })
        .toBuffer();

      const base64 = resizedIcon.toString('base64');
      console.log(`✅ Game icon processed for: ${game.title} (${resizedIcon.length} bytes)`);
      return `data:image/png;base64,${base64}`;
    } catch (error: any) {
      console.error(`Error fetching game icon for ${game.title}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch and process screenshot from Google Play Store with multiple fallbacks
   */
  private async fetchPlayStoreScreenshot(game: PlayStoreGame): Promise<{ buffer: Buffer; url: string } | null> {
    try {
      console.log(`🖼️ Fetching screenshot for game: ${game.title}`);
      
      // Helper function to try downloading from a list of URLs
      const tryDownloadScreenshot = async (urls: string[]): Promise<{ buffer: Buffer; url: string } | null> => {
        for (const url of urls) {
          try {
            console.log(`   Trying screenshot: ${url.substring(0, 80)}...`);
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://play.google.com/',
              },
              signal: AbortSignal.timeout(15000),
            });

            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              if (arrayBuffer.byteLength > 5000) {
                const buffer = Buffer.from(arrayBuffer);
                console.log(`   ✅ Screenshot downloaded for ${game.title}: ${buffer.length} bytes`);
                return { buffer, url };
              } else {
                console.log(`   ⚠️ Screenshot too small: ${arrayBuffer.byteLength} bytes`);
              }
            } else {
              console.log(`   ⚠️ Screenshot fetch failed: ${response.status}`);
            }
          } catch (e: any) {
            console.log(`   ⚠️ Screenshot URL failed: ${e.message}`);
          }
        }
        return null;
      };
      
      // Build list of screenshot URLs to try (from game screenshots array)
      const buildScreenshotUrls = (screenshots: string[] | undefined): string[] => {
        const urls: string[] = [];
        if (screenshots && screenshots.length > 0) {
          for (const ss of screenshots.slice(0, 5)) {
            const highRes = googlePlayService.getHighResScreenshot(ss);
            if (!urls.includes(highRes)) urls.push(highRes);
            const medRes = ss.replace(/=w\d+/g, '=w1280');
            if (!urls.includes(medRes)) urls.push(medRes);
            if (!urls.includes(ss)) urls.push(ss);
          }
        }
        return urls;
      };
      
      // First try with current game data
      let screenshotUrls = buildScreenshotUrls(game.screenshots);
      
      if (screenshotUrls.length > 0) {
        console.log(`🖼️ Trying ${screenshotUrls.length} screenshot URLs for: ${game.title}`);
        const result = await tryDownloadScreenshot(screenshotUrls);
        if (result) return result;
      }
      
      // If all URLs failed or no screenshots, fetch fresh data from API
      console.log(`   🔄 Fetching fresh game data from API for screenshots...`);
      const freshGame = await googlePlayService.getGameDetails(game.appId);
      
      if (freshGame?.screenshots && freshGame.screenshots.length > 0) {
        console.log(`   ✅ Got ${freshGame.screenshots.length} fresh screenshots from API`);
        const freshUrls = buildScreenshotUrls(freshGame.screenshots);
        
        // Also try headerImage if available
        if (freshGame.headerImage) {
          freshUrls.unshift(freshGame.headerImage);
        }
        
        if (freshUrls.length > 0) {
          console.log(`🖼️ Trying ${freshUrls.length} fresh screenshot URLs for: ${game.title}`);
          const result = await tryDownloadScreenshot(freshUrls);
          if (result) return result;
        }
      }

      console.log(`❌ All screenshot URLs failed for: ${game.title}`);
      return null;
    } catch (error: any) {
      console.error(`Error fetching screenshot for ${game.title}: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate professional bilingual descriptions using Play Store metadata
   */
  private async generatePlayStoreGameDescription(game: PlayStoreGame): Promise<{ descriptionAr: string; descriptionEn: string }> {
    const genreAr = googlePlayService.getGenreArabic(game.genre);
    const installsInfo = googlePlayService.formatInstalls(game.installs);
    const ratingDesc = game.score >= 4.5 ? 'legendary' : game.score >= 4 ? 'excellent' : game.score >= 3.5 ? 'great' : 'popular';
    const ratingDescAr = game.score >= 4.5 ? 'أسطورية' : game.score >= 4 ? 'استثنائية' : game.score >= 3.5 ? 'رائعة' : 'مشهورة';

    // Default templates if AI fails
    const createDescriptionAr = (): string => {
      const templates = [
        `${game.title} - اللعبة ${ratingDescAr} الأكثر تحميلاً على متجر جوجل بلاي! ${installsInfo.ar}. تقييم ${game.score}/5 من ملايين اللاعبين حول العالم. استمتع بتجربة ${genreAr} لا مثيل لها مع رسومات مذهلة وتحديات مثيرة. من تطوير ${game.developer}. حمّل ${game.title} مجاناً الآن!`,
        `اكتشف ${game.title} - اللعبة الأكثر شعبية في فئة ${genreAr}! ${installsInfo.ar} يثبت نجاحها الكبير. تقييم ${game.score}/5 من اللاعبين. رسومات خرافية وجيم بلاي مسلي. انضم لملايين اللاعبين وحمّل ${game.title} اليوم!`,
        `${game.title} من ${game.developer} - تحفة في عالم ألعاب ${genreAr}! حصلت على تقييم ${game.score}/5 وأكثر من ${installsInfo.ar}. عالم ضخم من الإثارة والمتعة ينتظرك. لا تفوت فرصة تجربة ${game.title} مجاناً!`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    };

    const createDescriptionEn = (): string => {
      const templates = [
        `${game.title} - The ${ratingDesc} ${game.genre} game dominating Google Play! ${installsInfo.en}. Rated ${game.score}/5 by millions worldwide. Experience unmatched gameplay with stunning graphics and endless challenges. Developed by ${game.developer}. Download ${game.title} FREE today!`,
        `Discover ${game.title} - The #1 ${game.genre} game everyone's playing! ${installsInfo.en} proves its massive success. ${game.score}/5 stars from players. Mind-blowing graphics and addictive gameplay await. Join millions and download ${game.title} now!`,
        `${game.title} by ${game.developer} - A masterpiece in ${game.genre} gaming! Rated ${game.score}/5 with ${installsInfo.en}. Immerse yourself in a world of excitement and fun. Don't miss your chance to try ${game.title} FREE!`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    };

    try {
      // Generate professional descriptions using AI with Play Store metadata
      const arPrompt = `اكتب وصفاً ترويجياً احترافياً ومثيراً من 3-4 جمل للعبة "${game.title}" للنشر على وسائل التواصل الاجتماعي.

معلومات اللعبة من متجر جوجل بلاي:
- النوع: ${game.genre} (${genreAr})
- التقييم: ${game.score}/5
- عدد التحميلات: ${game.installs}
- المطور: ${game.developer}
- السعر: ${game.free ? 'مجانية' : game.priceText}

المتطلبات:
1. اذكر اسم اللعبة "${game.title}" مرتين على الأقل
2. اذكر التقييم وعدد التحميلات
3. اجعل الوصف مثيراً ويحفز على التحميل الفوري
4. لا تكتب أي مقدمات أو عناوين، فقط الوصف الترويجي`;

      const enPrompt = `Write a professional and exciting 3-4 sentence promotional description for the game "${game.title}" for social media.

Game info from Google Play Store:
- Genre: ${game.genre}
- Rating: ${game.score}/5
- Downloads: ${game.installs}
- Developer: ${game.developer}
- Price: ${game.free ? 'Free' : game.priceText}

Requirements:
1. Mention the game name "${game.title}" at least twice
2. Include the rating and download count
3. Make it exciting and encourage immediate download
4. Write ONLY the description without any titles or introductions`;

      const systemPromptAr = 'أنت كاتب محتوى ألعاب محترف. اكتب بأسلوب مثير وجذاب للجيمرز. استخدم معلومات متجر جوجل بلاي الرسمية.';
      const systemPromptEn = 'You are a professional gaming content writer. Write in an exciting, engaging style for gamers. Use official Google Play Store data.';

      const [arResult, enResult] = await Promise.all([
        deepseekSDK.generateSimple(arPrompt, systemPromptAr, { temperature: 0.7, max_tokens: 250 }),
        deepseekSDK.generateSimple(enPrompt, systemPromptEn, { temperature: 0.7, max_tokens: 250 }),
      ]);

      let descAr = arResult?.trim() || '';
      let descEn = enResult?.trim() || '';

      // Fallback if AI doesn't include the game name
      if (!descAr || !descAr.includes(game.title)) {
        descAr = createDescriptionAr();
      }
      if (!descEn || !descEn.includes(game.title)) {
        descEn = createDescriptionEn();
      }
      
      return { descriptionAr: descAr, descriptionEn: descEn };
    } catch (error) {
      console.log(`⚠️ AI generation failed for ${game.title}, using template fallback`);
      return {
        descriptionAr: createDescriptionAr(),
        descriptionEn: createDescriptionEn(),
      };
    }
  }

  private async generatePlaceholderImage(title: string, category: string): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;
    
    const gradients: Record<string, { from: string; to: string }> = {
      'movies': { from: '#1a1a2e', to: '#16213e' },
      'tv_shows': { from: '#0f0e17', to: '#2a2438' },
      'sports': { from: '#1b4332', to: '#2d6a4f' },
      'recipes': { from: '#7c2d12', to: '#ea580c' },
      'gaming': { from: '#3b0764', to: '#7c3aed' },
      'apps': { from: '#0c4a6e', to: '#0284c7' },
      'tv_channels': { from: '#134e4a', to: '#14b8a6' },
    };
    
    const colors = gradients[category] || gradients['gaming'];
    
    try {
      const safeTitle = (title || category).trim();
      const displayTitle = safeTitle.length > 20 ? safeTitle.substring(0, 20) + '...' : safeTitle;
      const words = safeTitle.split(' ').filter(w => w.length > 0);
      const initials = words.length === 0 ? 'G' : words.slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || 'G';
      const escapedTitle = escapeXml(displayTitle);
      const escapedInitials = escapeXml(initials);
      
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${colors.from};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${colors.to};stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#bg)"/>
          <circle cx="${width/2}" cy="${height/2 - 100}" r="150" fill="rgba(255,255,255,0.1)"/>
          <text x="${width/2}" y="${height/2 - 50}" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="white" text-anchor="middle">${escapedInitials}</text>
          <text x="${width/2}" y="${height/2 + 150}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">${escapedTitle}</text>
        </svg>
      `;
      
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(width, height)
        .png({ quality: 100 })
        .toBuffer();
      
      return pngBuffer;
    } catch (error: any) {
      console.log(`⚠️ SVG placeholder failed: ${error.message}, using solid color fallback`);
      const solidBuffer = await sharp({
        create: {
          width: width,
          height: height,
          channels: 3,
          background: { r: 59, g: 7, b: 100 }
        }
      })
        .png()
        .toBuffer();
      
      return solidBuffer;
    }
  }

  private async createSimpleGamingFallback(
    imageBuffer: Buffer, 
    gameName: string,
    promoAr: string = '',
    promoEn: string = '',
    gameLogoBase64: string | null = null
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;
    
    try {
      const processedImage = await sharp(imageBuffer)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .modulate({ brightness: 0.55, saturation: 0.85 })
        .png()
        .toBuffer();

      const safeGameName = (gameName || 'Game').trim();
      const escapedGameName = escapeXml(safeGameName);
      const gameInitials = escapeXml(this.getGameInitials(safeGameName));
      const nameLines = this.wrapText(safeGameName, 16, 2).map(line => escapeXml(line));
      const promoArLines = this.wrapText(promoAr || GAMING_PROMOTIONAL_AR[0], 30, 4).map(line => escapeXml(line));
      const promoEnLines = this.wrapText(promoEn || GAMING_PROMOTIONAL_EN[0], 38, 4).map(line => escapeXml(line));

      const validatedLogo = await this.validateAndProcessBase64Image(gameLogoBase64);
      
      const logoElement = validatedLogo 
        ? `<image x="${width / 2 - 70}" y="95" width="140" height="140" href="${validatedLogo}" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="${width / 2}" y="180" font-family="Arial, sans-serif" font-size="70" font-weight="bold" fill="white" text-anchor="middle">${gameInitials}</text>`;

      const svgOverlay = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <defs>
            <linearGradient id="topGradFb" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgba(0,0,0,0.75);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            </linearGradient>
            <linearGradient id="bottomGradFb" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
              <stop offset="40%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgba(0,0,0,0.9);stop-opacity:1" />
            </linearGradient>
            <linearGradient id="purpleGradFb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="goldGradFb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="greenGradFb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="redGradFb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
            </linearGradient>
          </defs>
          
          <!-- Top gradient -->
          <rect x="0" y="0" width="${width}" height="350" fill="url(#topGradFb)"/>
          
          <!-- Bottom gradient -->
          <rect x="0" y="${height - 700}" width="${width}" height="700" fill="url(#bottomGradFb)"/>
          
          <!-- TRENDING Badge -->
          <rect x="${width / 2 - 110}" y="25" width="220" height="40" rx="20" fill="url(#redGradFb)"/>
          <text x="${width / 2}" y="52" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">TRENDING NOW</text>
          
          <!-- Logo Container -->
          <rect x="${width / 2 - 80}" y="85" width="160" height="160" rx="30" fill="url(#purpleGradFb)"/>
          <rect x="${width / 2 - 75}" y="90" width="150" height="150" rx="27" fill="rgba(255,255,255,0.15)"/>
          ${logoElement}
          
          <!-- Game Name -->
          <rect x="${width / 2 - 260}" y="265" width="520" height="${nameLines.length * 70 + 30}" rx="15" fill="rgba(0,0,0,0.5)"/>
          ${nameLines.map((line, index) => `
          <text x="${width / 2}" y="${315 + (index * 70)}" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">
            ${line}
          </text>
          `).join('')}
          
          <!-- Arabic Label with Game Name -->
          <rect x="${width / 2 - 170}" y="${325 + (nameLines.length * 70)}" width="340" height="48" rx="24" fill="url(#goldGradFb)"/>
          <text x="${width / 2}" y="${358 + (nameLines.length * 70)}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
            لعبة الترند - ${escapedGameName.length > 12 ? escapedGameName.substring(0, 12) + '...' : escapedGameName}
          </text>
          
          <!-- Rating Stars -->
          <text x="${width / 2}" y="${398 + (nameLines.length * 70)}" font-size="26" fill="#fbbf24" text-anchor="middle">★ ★ ★ ★ ★</text>
          
          <!-- Arabic Promo Text - 4 Lines -->
          <rect x="50" y="${height - 580}" width="${width - 100}" height="${promoArLines.length * 36 + 25}" rx="12" fill="rgba(124,58,237,0.8)"/>
          ${promoArLines.map((line, index) => `
          <text x="${width / 2}" y="${height - 552 + (index * 36)}" font-family="Arial, sans-serif" font-size="23" font-weight="bold" fill="white" text-anchor="middle" direction="rtl">
            ${line}
          </text>
          `).join('')}
          
          <!-- English Promo Text - 4 Lines with clear readable background -->
          <rect x="50" y="${height - 400}" width="${width - 100}" height="${promoEnLines.length * 32 + 28}" rx="12" fill="rgba(0,0,0,0.75)"/>
          ${promoEnLines.map((line, index) => `
          <text x="${width / 2}" y="${height - 372 + (index * 32)}" font-family="Arial, sans-serif" font-size="21" font-weight="600" fill="white" text-anchor="middle" font-style="italic">
            ${line}
          </text>
          `).join('')}
          
          <!-- CTA Button - Expanded to fit all text properly -->
          <rect x="${width / 2 - 340}" y="${height - 200}" width="680" height="185" rx="28" fill="url(#greenGradFb)"/>
          <text x="${width / 2}" y="${height - 115}" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle" direction="rtl">
            ${escapeXml(GAMING_CTA_AR)}
          </text>
          <text x="${width / 2}" y="${height - 65}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
            ${escapeXml(GAMING_CTA_EN)}
          </text>
        </svg>
      `;

      const overlayBuffer = Buffer.from(svgOverlay);

      return await sharp(processedImage)
        .composite([{ input: overlayBuffer, top: 0, left: 0 }])
        .png()
        .toBuffer();
    } catch (error: any) {
      console.log(`⚠️ Enhanced fallback also failed: ${error.message}, returning base image`);
      return await sharp(imageBuffer)
        .resize(width, height, { fit: 'cover' })
        .png()
        .toBuffer();
    }
  }

  private getGameInitials(gameName: string): string {
    const words = gameName.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 'G';
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  private async validateAndProcessBase64Image(base64Data: string | null): Promise<string | null> {
    if (!base64Data) return null;
    
    const allowedMimeTypes = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/webp'];
    const hasValidMimeType = allowedMimeTypes.some(type => base64Data.startsWith(type));
    if (!hasValidMimeType) return null;
    if (!base64Data.includes('base64,')) return null;
    
    try {
      const base64Content = base64Data.split('base64,')[1];
      if (!base64Content || base64Content.length < 100) return null;
      const decoded = Buffer.from(base64Content, 'base64');
      if (decoded.length < 100) return null;
      
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
      const webpSignature = Buffer.from([0x52, 0x49, 0x46, 0x46]);
      
      const isPng = decoded.subarray(0, 8).equals(pngSignature);
      const isJpeg = decoded.subarray(0, 3).equals(jpegSignature);
      const isWebp = decoded.subarray(0, 4).equals(webpSignature);
      
      if (!isPng && !isJpeg && !isWebp) return null;
      
      const validated = await sharp(decoded)
        .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      
      return `data:image/png;base64,${validated.toString('base64')}`;
    } catch (e) {
      console.log(`⚠️ Logo validation failed: ${e}`);
      return null;
    }
  }

  private async createGamingOverlay(
    imageBuffer: Buffer,
    gameName: string,
    promoAr: string,
    promoEn: string,
    gameLogoBase64: string | null = null
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    const resizedImage = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .toBuffer();

    const safeGameName = (gameName || 'Game').trim();
    const gameInitials = escapeXml(this.getGameInitials(safeGameName));
    const escapedGameName = escapeXml(safeGameName);
    const nameLines = this.wrapText(safeGameName, 16, 2).map(line => escapeXml(line));
    const promoArLines = this.wrapText(promoAr || '', 28, 4).map(line => escapeXml(line));
    const promoEnLines = this.wrapText(promoEn || '', 34, 4).map(line => escapeXml(line));

    const validatedLogo = await this.validateAndProcessBase64Image(gameLogoBase64);

    const logoElement = validatedLogo 
      ? `<image x="${width / 2 - 80}" y="85" width="160" height="160" href="${validatedLogo}" preserveAspectRatio="xMidYMid meet" filter="url(#logoShadow)"/>`
      : `<text x="${width / 2}" y="${gameInitials.length === 1 ? 190 : 185}" font-family="Arial, sans-serif" font-size="${gameInitials.length === 1 ? 90 : 75}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#neonGlow)">${gameInitials}</text>`;

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="30%" style="stop-color:rgba(0,0,0,0.2);stop-opacity:1" />
            <stop offset="60%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.75);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="greenPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="rgba(0,0,0,0.98)"/>
          </filter>
          <filter id="logoShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.9)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="neonGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="titleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
        </defs>
        
        <!-- Top gradient for header - smaller and more transparent -->
        <rect x="0" y="0" width="${width}" height="320" fill="url(#topGrad)"/>
        
        <!-- Bottom gradient for content - smaller and more transparent -->
        <rect x="0" y="${height - 600}" width="${width}" height="600" fill="url(#bottomGrad)"/>
        
        <!-- TRENDING NOW Badge at top -->
        <rect x="${width / 2 - 120}" y="20" width="240" height="42" rx="21" fill="url(#redGrad)" filter="url(#shadow)"/>
        <circle cx="${width / 2 - 85}" cy="41" r="8" fill="white">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="${width / 2 + 10}" y="49" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">
          TRENDING NOW
        </text>
        
        <!-- Professional Game Logo Container -->
        <rect x="${width / 2 - 90}" y="75" width="180" height="180" rx="35" fill="url(#blueGrad)" filter="url(#shadow)"/>
        <rect x="${width / 2 - 85}" y="80" width="170" height="170" rx="32" fill="url(#neonGrad)"/>
        <rect x="${width / 2 - 82}" y="83" width="164" height="164" rx="30" fill="rgba(255,255,255,0.15)"/>
        ${logoElement}
        
        <!-- GAME NAME - Large Professional Title with actual game name - transparent background only around text -->
        <rect x="${width / 2 - 280}" y="275" width="560" height="${nameLines.length * 75 + 40}" rx="18" fill="rgba(0,0,0,0.45)" filter="url(#shadow)"/>
        ${nameLines.map((line, index) => `
        <text x="${width / 2}" y="${330 + (index * 75)}" font-family="Arial, sans-serif" font-size="58" font-weight="bold" fill="white" text-anchor="middle" filter="url(#titleGlow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- Arabic Game Label with game name -->
        <rect x="${width / 2 - 180}" y="${340 + (nameLines.length * 75)}" width="360" height="55" rx="27" fill="url(#goldGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${377 + (nameLines.length * 75)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          لعبة الترند الأولى - ${escapedGameName.length > 15 ? escapedGameName.substring(0, 15) + '...' : escapedGameName}
        </text>
        
        <!-- Rating Stars -->
        <g transform="translate(${width / 2 - 80}, ${405 + (nameLines.length * 75)})">
          <text x="0" y="25" font-size="28" fill="#fbbf24" filter="url(#glow)">★</text>
          <text x="35" y="25" font-size="28" fill="#fbbf24" filter="url(#glow)">★</text>
          <text x="70" y="25" font-size="28" fill="#fbbf24" filter="url(#glow)">★</text>
          <text x="105" y="25" font-size="28" fill="#fbbf24" filter="url(#glow)">★</text>
          <text x="140" y="25" font-size="28" fill="#fbbf24" filter="url(#glow)">★</text>
        </g>
        
        <!-- Arabic Promotional Text - 4 Lines with better spacing and transparency (raised by 170px) -->
        <rect x="40" y="${height - 730}" width="${width - 80}" height="${promoArLines.length * 38 + 30}" rx="16" fill="rgba(124,58,237,0.75)" filter="url(#shadow)"/>
        ${promoArLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 698 + (index * 38)}" font-family="Arial, sans-serif" font-size="25" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#textShadow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text - 4 Lines with clear readable background (raised by 170px) -->
        <rect x="45" y="${height - 540}" width="${width - 90}" height="${promoEnLines.length * 32 + 30}" rx="16" fill="rgba(0,0,0,0.7)" filter="url(#shadow)"/>
        ${promoEnLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 512 + (index * 32)}" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="white" text-anchor="middle" font-style="italic" filter="url(#textShadow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- SWIPE UP CTA Button - Professional Gaming Style with Arrow - Positioned higher for Facebook Story visibility (raised by 170px) -->
        <rect x="${width / 2 - 320}" y="${height - 490}" width="640" height="180" rx="28" fill="url(#greenPlayGrad)" filter="url(#shadow)"/>
        
        <!-- Animated Swipe Up Arrow -->
        <g transform="translate(${width / 2}, ${height - 465})">
          <path d="M-15 20 L0 5 L15 20" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-8;0,0" dur="1s" repeatCount="indefinite"/>
          </path>
          <path d="M-10 35 L0 25 L10 35" stroke="rgba(255,255,255,0.6)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" begin="0.15s"/>
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-8;0,0" dur="1s" repeatCount="indefinite" begin="0.15s"/>
          </path>
        </g>
        
        <text x="${width / 2}" y="${height - 395}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#textShadow)">
          ${GAMING_CTA_AR}
        </text>
        <text x="${width / 2}" y="${height - 350}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="white" text-anchor="middle" filter="url(#textShadow)">
          ${GAMING_CTA_EN}
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    return await sharp(resizedImage)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .toBuffer();
  }

  private async generateAppPoster(): Promise<TrendingPosterResult> {
    console.log('📱 Generating App Poster from Google Play Store...');
    
    // Get trending app from Google Play Store
    const trendingApp = await googlePlayService.getRandomTrendingApp();
    const appName = trendingApp.title;
    const appGenre = trendingApp.genre;
    const appGenreAr = googlePlayService.getAppGenreArabic(appGenre);
    const installsInfo = googlePlayService.formatInstalls(trendingApp.installs);
    
    console.log(`📱 Selected trending app from Play Store: ${appName}`);
    console.log(`   Genre: ${appGenre} (${appGenreAr})`);
    console.log(`   Rating: ${trendingApp.score}/5`);
    console.log(`   Installs: ${trendingApp.installs}`);
    console.log(`   Developer: ${trendingApp.developer}`);
    
    let imageBuffer: Buffer | null = null;
    let usedImageUrl: string = '';
    let appLogoBase64: string | null = null;
    
    // Fetch app icon (logo) and best screenshot using smart selection algorithm
    const [logoResult, bestScreenshotUrl] = await Promise.all([
      this.fetchPlayStoreGameIcon(trendingApp),
      googlePlayService.getBestAppScreenshot(trendingApp),
    ]);
    
    appLogoBase64 = logoResult;
    
    // Download the best screenshot for full poster background (like gaming posters)
    if (bestScreenshotUrl) {
      usedImageUrl = bestScreenshotUrl;
      console.log(`🎯 Using best screenshot selected by smart algorithm: ${bestScreenshotUrl.substring(0, 80)}...`);
      try {
        imageBuffer = await this.downloadImage(bestScreenshotUrl);
        console.log(`✅ Screenshot downloaded for full poster background`);
      } catch (error: any) {
        console.log(`⚠️ Best screenshot download failed: ${error.message}`);
      }
    }
    
    // Fallback to regular screenshot fetch if best screenshot failed
    if (!imageBuffer) {
      const screenshotResult = await this.fetchPlayStoreScreenshot(trendingApp);
      if (screenshotResult) {
        imageBuffer = screenshotResult.buffer;
        usedImageUrl = screenshotResult.url;
        console.log(`✅ Fallback screenshot downloaded for poster background`);
      }
    }
    
    // If no screenshot available, use generated placeholder
    if (!imageBuffer) {
      console.log('📸 No screenshot available, using generated placeholder');
      imageBuffer = await this.generatePlaceholderImage(appName, 'apps');
      usedImageUrl = 'generated-placeholder';
    }

    console.log(`🤖 Generating professional bilingual descriptions for app: ${appName}`);
    let promoAr: string;
    let promoEn: string;
    
    try {
      const posterContent = await this.generatePlayStoreAppDescription(trendingApp);
      promoAr = posterContent.descriptionAr;
      promoEn = posterContent.descriptionEn;
      console.log(`✅ AI descriptions generated with app name: ${appName}`);
    } catch (error) {
      console.log(`⚠️ AI generation failed, using template descriptions for: ${appName}`);
      const ratingText = trendingApp.score > 4 ? 'استثنائي' : trendingApp.score > 3.5 ? 'ممتاز' : 'رائع';
      promoAr = `${appName} - التطبيق ${ratingText} الأكثر تحميلاً على متجر بلاي! ${installsInfo.ar}. تقييم ${trendingApp.score}/5 من ملايين المستخدمين. استمتع بتجربة ${appGenreAr} لا مثيل لها مع تصميم عصري وميزات احترافية. من تطوير ${trendingApp.developer}. حمّل ${appName} مجاناً الآن واحصل على Premium!`;
      promoEn = `${appName} - The top-rated ${appGenre} app on Google Play! ${installsInfo.en}. Rated ${trendingApp.score}/5 by millions of users worldwide. Experience unmatched ${appGenre} functionality with modern design and professional features. Developed by ${trendingApp.developer}. Download ${appName} FREE today and get Premium!`;
    }
    
    const validImageBuffer: Buffer = imageBuffer;
    
    let processedImage: Buffer;
    try {
      processedImage = await this.createAppOverlay(
        validImageBuffer,
        appName,
        promoAr,
        promoEn,
        appLogoBase64,
        appGenreAr
      );
    } catch (overlayError: any) {
      console.log(`⚠️ App overlay failed: ${overlayError.message}, using simple fallback`);
      processedImage = await this.createSimpleAppFallback(
        validImageBuffer,
        appName,
        promoAr,
        promoEn,
        appLogoBase64
      );
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/apps/${timestamp}-${randomId}`;

    const [pngBuffer, webpBuffer] = await Promise.all([
      sharp(processedImage).png({ quality: 95 }).toBuffer(),
      sharp(processedImage).webp({ quality: 90 }).toBuffer(),
    ]);

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category: 'apps', topic: appName, source: 'google-play' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'apps', topic: appName, source: 'google-play' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category: 'apps', topic: appName, platform: 'facebook', source: 'google-play' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category: 'apps', topic: appName, platform: 'instagram', source: 'google-play' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'apps', topic: appName, platform: 'tiktok', source: 'google-play' },
      }),
    ]);

    console.log(`✅ App poster for "${appName}" uploaded successfully (source: Google Play Store)`);

    const metadata: PosterImageMetadata = {
      category: 'apps',
      trendingTerm: appName,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic: appName,
      posterTitle: appName,
      sourceImageUrl: usedImageUrl,
      metadata,
      descriptionAr: promoAr,
      descriptionEn: promoEn,
      voteAverage: trendingApp.score,
    };
  }

  /**
   * Generate professional descriptions for Play Store apps using AI
   */
  private async generatePlayStoreAppDescription(app: PlayStoreGame): Promise<{ descriptionAr: string; descriptionEn: string }> {
    const appGenreAr = googlePlayService.getAppGenreArabic(app.genre);
    const installsInfo = googlePlayService.formatInstalls(app.installs);
    const ratingText = app.score > 4 ? 'استثنائي' : app.score > 3.5 ? 'ممتاز' : 'رائع';
    
    // Generate rich descriptions using app details
    const descriptionAr = `${app.title} - التطبيق ${ratingText} الأكثر تحميلاً في فئة ${appGenreAr}! ${installsInfo.ar}. تقييم ${app.score}/5 من ملايين المستخدمين حول العالم. تصميم عصري أنيق وأداء فائق السرعة بدون أي تأخير. ميزات احترافية حصرية ستغير طريقة استخدامك للهاتف. حمّل ${app.title} الآن واحصل على Premium مجاناً!`;
    
    const descriptionEn = `${app.title} - The top-rated ${app.genre} app with ${installsInfo.en}! Rated ${app.score}/5 by millions worldwide. Elegant modern design with super-fast performance and zero lag. Exclusive professional features that will transform how you use your phone. Download ${app.title} now and get Premium FREE!`;
    
    return { descriptionAr, descriptionEn };
  }

  private async createAppOverlay(
    imageBuffer: Buffer,
    appName: string,
    promoAr: string,
    promoEn: string,
    appLogoBase64: string | null = null,
    appGenreAr: string = 'تطبيق'
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    // Resize screenshot to cover entire poster (no black areas, fills completely)
    const resizedImage = await sharp(imageBuffer)
      .resize(width, height, { 
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    const nameLines = this.wrapText(appName, 16, 2).map(line => escapeXml(line));
    const promoArLines = this.wrapText(promoAr, 28, 4).map(line => escapeXml(line));
    const promoEnLines = this.wrapText(promoEn, 34, 4).map(line => escapeXml(line));
    const appInitials = escapeXml(this.getGameInitials(appName));
    const safeGenreAr = escapeXml(appGenreAr);

    const validatedLogo = await this.validateAndProcessBase64Image(appLogoBase64);

    // Create app icon element - either real logo or fallback with initials
    const appIconElement = validatedLogo
      ? `<image x="${width / 2 - 80}" y="85" width="160" height="160" href="${validatedLogo}" preserveAspectRatio="xMidYMid meet" filter="url(#logoShadow)"/>`
      : `<text x="${width / 2}" y="${appInitials.length === 1 ? 190 : 185}" font-family="Arial, sans-serif" font-size="${appInitials.length === 1 ? 90 : 75}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#neonGlow)">${appInitials}</text>`;

    // SVG overlay (composited on top of the screenshot background)
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="30%" style="stop-color:rgba(0,0,0,0.2);stop-opacity:1" />
            <stop offset="60%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.75);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="premiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#a855f7;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#d946ef;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0891b2;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="greenPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e40af;stop-opacity:0.5" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.5" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="rgba(0,0,0,0.98)"/>
          </filter>
          <filter id="logoShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.9)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="neonGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="titleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
        </defs>
        
        <!-- Subtle top gradient for header only -->
        <rect x="0" y="0" width="${width}" height="280" fill="url(#topGrad)"/>
        
        <!-- Subtle bottom gradient only for CTA area -->
        <rect x="0" y="${height - 280}" width="${width}" height="280" fill="url(#bottomGrad)"/>
        
        <!-- TRENDING NOW Badge at top -->
        <rect x="${width / 2 - 120}" y="20" width="240" height="42" rx="21" fill="url(#premiumGrad)" filter="url(#shadow)"/>
        <circle cx="${width / 2 - 85}" cy="41" r="8" fill="white">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="${width / 2 + 10}" y="49" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">
          TRENDING NOW
        </text>
        
        <!-- Professional App Logo Container -->
        <rect x="${width / 2 - 90}" y="75" width="180" height="180" rx="35" fill="url(#blueGrad)" filter="url(#shadow)"/>
        <rect x="${width / 2 - 85}" y="80" width="170" height="170" rx="32" fill="url(#neonGrad)"/>
        <rect x="${width / 2 - 82}" y="83" width="164" height="164" rx="30" fill="rgba(255,255,255,0.15)"/>
        ${appIconElement}
        
        <!-- APP NAME - Compact Semi-transparent Background Only Under Text -->
        <rect x="${width / 2 - 250}" y="275" width="500" height="${nameLines.length * 70 + 25}" rx="16" fill="rgba(0,0,0,0.25)"/>
        ${nameLines.map((line, index) => `
        <text x="${width / 2}" y="${318 + (index * 70)}" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="white" text-anchor="middle" filter="url(#titleGlow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- Badges Row - Compact Design -->
        <g transform="translate(${width / 2}, ${305 + nameLines.length * 70})">
          <rect x="-180" y="0" width="120" height="38" rx="19" fill="url(#goldGrad)" filter="url(#shadow)"/>
          <text x="-120" y="26" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle" direction="rtl">
            TRENDING
          </text>
          
          <rect x="60" y="0" width="120" height="38" rx="19" fill="url(#cyanGrad)" filter="url(#shadow)"/>
          <text x="120" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle" direction="rtl">
            ${safeGenreAr}
          </text>
        </g>
        
        <!-- Arabic Promotional Text with Blue Background - Full Width (raised by 170px) -->
        <rect x="20" y="${height - 750}" width="${width - 40}" height="${Math.min(promoArLines.length, 3) * 42 + 30}" rx="16" fill="url(#blueGrad)" filter="url(#shadow)"/>
        ${promoArLines.slice(0, 3).map((line, index) => `
        <text x="${width / 2}" y="${height - 715 + (index * 42)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#textShadow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text with Black Transparent Background - Full Width (raised by 170px) -->
        <rect x="20" y="${height - 605}" width="${width - 40}" height="${Math.min(promoEnLines.length, 3) * 38 + 25}" rx="16" fill="rgba(0,0,0,0.5)" filter="url(#shadow)"/>
        ${promoEnLines.slice(0, 3).map((line, index) => `
        <text x="${width / 2}" y="${height - 570 + (index * 38)}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" font-style="italic">
          ${line}
        </text>
        `).join('')}
        
        <!-- Professional CTA Button with Premium Gradient - Full Width - Positioned higher for Facebook Story visibility (raised by 170px) -->
        <rect x="20" y="${height - 470}" width="${width - 40}" height="155" rx="22" fill="url(#premiumGrad)" filter="url(#shadow)"/>
        <rect x="25" y="${height - 465}" width="${width - 50}" height="145" rx="20" fill="rgba(255,255,255,0.1)"/>
        
        <!-- Animated Arrow Icon -->
        <g transform="translate(${width / 2}, ${height - 440})">
          <path d="M-15 22 L0 7 L15 22" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-6;0,0" dur="1s" repeatCount="indefinite"/>
          </path>
        </g>
        
        <!-- Arabic CTA Text - Larger and Clearer -->
        <text x="${width / 2}" y="${height - 380}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${escapeXml(APPS_CTA_AR)}
        </text>
        
        <!-- English CTA Text - Larger and Clearer -->
        <text x="${width / 2}" y="${height - 335}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">
          ${escapeXml(APPS_CTA_EN)}
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    return await sharp(resizedImage)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .toBuffer();
  }

  private async createSimpleAppFallback(
    imageBuffer: Buffer, 
    appName: string,
    promoAr: string = '',
    promoEn: string = '',
    appLogoBase64: string | null = null
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;
    
    try {
      // Resize screenshot to cover entire poster (no black areas, fills completely)
      const processedImage = await sharp(imageBuffer)
        .resize(width, height, { 
          fit: 'cover',
          position: 'center'
        })
        .modulate({ brightness: 0.85, saturation: 0.95 })
        .png()
        .toBuffer();

      const safeAppName = (appName || 'App').trim();
      const appInitials = escapeXml(this.getGameInitials(safeAppName));
      const nameLines = this.wrapText(safeAppName, 16, 2).map(line => escapeXml(line));
      const promoArLines = this.wrapText(promoAr || 'تطبيق مميز وحصري!', 30, 3).map(line => escapeXml(line));
      const promoEnLines = this.wrapText(promoEn || 'Amazing exclusive app!', 38, 3).map(line => escapeXml(line));

      const validatedLogo = await this.validateAndProcessBase64Image(appLogoBase64);
      
      const logoElement = validatedLogo 
        ? `<image x="${width / 2 - 70}" y="95" width="140" height="140" href="${validatedLogo}" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="${width / 2}" y="180" font-family="Arial, sans-serif" font-size="70" font-weight="bold" fill="white" text-anchor="middle">${appInitials}</text>`;

      const svgOverlay = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <defs>
            <linearGradient id="topGradApp" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            </linearGradient>
            <linearGradient id="bottomGradApp" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
              <stop offset="50%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            </linearGradient>
            <linearGradient id="cyanGradApp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#0891b2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="goldGradApp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="purpleGradApp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="blueGradFb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
            </linearGradient>
            <filter id="textShadowFb" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.9)"/>
            </filter>
          </defs>
          
          <!-- Top gradient - reduced height -->
          <rect x="0" y="0" width="${width}" height="280" fill="url(#topGradApp)"/>
          
          <!-- Bottom gradient - reduced height -->
          <rect x="0" y="${height - 280}" width="${width}" height="280" fill="url(#bottomGradApp)"/>
          
          <!-- TRENDING Badge -->
          <rect x="${width / 2 - 100}" y="25" width="200" height="38" rx="19" fill="url(#purpleGradApp)"/>
          <text x="${width / 2}" y="50" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">TRENDING NOW</text>
          
          <!-- Logo Container -->
          <rect x="${width / 2 - 75}" y="80" width="150" height="150" rx="28" fill="url(#cyanGradApp)"/>
          <rect x="${width / 2 - 70}" y="85" width="140" height="140" rx="25" fill="rgba(255,255,255,0.12)"/>
          ${logoElement}
          
          <!-- App Name - Semi-transparent compact background -->
          <rect x="${width / 2 - 220}" y="250" width="440" height="${nameLines.length * 65 + 20}" rx="14" fill="rgba(0,0,0,0.2)"/>
          ${nameLines.map((line, index) => `
          <text x="${width / 2}" y="${295 + (index * 65)}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle" filter="url(#textShadowFb)">
            ${line}
          </text>
          `).join('')}
          
          <!-- Trend Badge -->
          <rect x="${width / 2 - 70}" y="${280 + (nameLines.length * 65)}" width="140" height="35" rx="17" fill="url(#goldGradApp)"/>
          <text x="${width / 2}" y="${304 + (nameLines.length * 65)}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">
            TRENDING
          </text>
          
          <!-- Arabic Promo Text with Blue Background - Full Width (raised by 170px) -->
          <rect x="20" y="${height - 730}" width="${width - 40}" height="${Math.min(promoArLines.length, 2) * 38 + 24}" rx="14" fill="url(#blueGradFb)" filter="url(#textShadowFb)"/>
          ${promoArLines.slice(0, 2).map((line, index) => `
          <text x="${width / 2}" y="${height - 700 + (index * 38)}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle" direction="rtl">
            ${line}
          </text>
          `).join('')}
          
          <!-- English Promo Text with Black Transparent Background - Full Width (raised by 170px) -->
          <rect x="20" y="${height - 615}" width="${width - 40}" height="${Math.min(promoEnLines.length, 2) * 34 + 20}" rx="14" fill="rgba(0,0,0,0.6)" filter="url(#textShadowFb)"/>
          ${promoEnLines.slice(0, 2).map((line, index) => `
          <text x="${width / 2}" y="${height - 590 + (index * 34)}" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle" font-style="italic">
            ${line}
          </text>
          `).join('')}
          
          <!-- CTA Button - Premium Design - Full Width - Positioned higher for Facebook Story visibility (raised by 170px) -->
          <rect x="20" y="${height - 470}" width="${width - 40}" height="155" rx="22" fill="url(#purpleGradApp)"/>
          <rect x="25" y="${height - 465}" width="${width - 50}" height="145" rx="20" fill="rgba(255,255,255,0.1)"/>
          
          <text x="${width / 2}" y="${height - 385}" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle" direction="rtl">
            ${escapeXml(APPS_CTA_AR)}
          </text>
          <text x="${width / 2}" y="${height - 340}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">
            ${escapeXml(APPS_CTA_EN)}
          </text>
        </svg>
      `;

      const overlayBuffer = Buffer.from(svgOverlay);

      return await sharp(processedImage)
        .composite([{ input: overlayBuffer, top: 0, left: 0 }])
        .png()
        .toBuffer();
    } catch (error: any) {
      console.log(`⚠️ App fallback also failed: ${error.message}, returning base image`);
      return await sharp(imageBuffer)
        .resize(width, height, { fit: 'cover' })
        .png()
        .toBuffer();
    }
  }

  private async generateTVChannelsPoster(): Promise<TrendingPosterResult> {
    console.log('📺 Generating TV Channels Poster...');
    
    const trendResult = await googleTrendsService.getBestTrendForCategory('tv_channels');
    const trendingTopic = trendResult.trendingTerm;
    
    console.log(`📺 Trending TV channel topic: ${trendingTopic}`);
    
    const categoryQueries = CATEGORY_SEARCH_QUERIES['tv_channels'];
    const searchQuery = `${trendingTopic} ${categoryQueries[Math.floor(Math.random() * categoryQueries.length)]}`;
    
    let imageResult = await googleImageSearchService.searchThumbnailImage(searchQuery, 'tv_channels');
    
    if (!imageResult) {
      imageResult = await googleImageSearchService.searchThumbnailImage(categoryQueries[0], 'tv_channels');
    }

    if (!imageResult) {
      try {
        console.log('🎨 Generating HD image using Hugging Face Flux...');
        const imagePrompt = await generateCategoryImagePrompt(trendingTopic, 'tv_channels', true);
        const generatedImage = await huggingFaceSDK.generateImage(imagePrompt);
        
        if (generatedImage && generatedImage.imageData) {
          const generatedBuffer = Buffer.from(generatedImage.imageData, 'base64');
          imageResult = {
            imageUrl: 'generated',
            thumbnailUrl: 'generated',
            source: 'huggingface',
            title: trendingTopic,
            generatedBuffer: generatedBuffer,
          } as any;
        }
      } catch (err) {
        console.error('Failed to generate image with Hugging Face:', err);
      }
    }

    if (!imageResult) {
      throw new Error('لم يتم العثور على صور مناسبة للقناة التلفزيونية');
    }

    const promoIndex = Math.floor(Math.random() * TV_CHANNELS_PROMOTIONAL_AR.length);
    const promoAr = TV_CHANNELS_PROMOTIONAL_AR[promoIndex];
    const promoEn = TV_CHANNELS_PROMOTIONAL_EN[promoIndex];

    const imageBuffer = (imageResult as any).generatedBuffer || await this.downloadImage(imageResult.imageUrl);
    
    const processedImage = await this.createTVChannelOverlay(
      imageBuffer,
      trendingTopic,
      promoAr,
      promoEn
    );

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const baseFileName = `trending/tv_channels/${timestamp}-${randomId}`;

    const [pngBuffer, webpBuffer] = await Promise.all([
      sharp(processedImage).png({ quality: 95 }).toBuffer(),
      sharp(processedImage).webp({ quality: 90 }).toBuffer(),
    ]);

    const [pngUrl, webpUrl, fbPngUrl, igPngUrl, tiktokWebpUrl] = await Promise.all([
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-original.png`, {
        contentType: 'image/png',
        metadata: { category: 'tv_channels', topic: trendingTopic, source: 'google' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-original.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'tv_channels', topic: trendingTopic, source: 'google' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-facebook.png`, {
        contentType: 'image/png',
        metadata: { category: 'tv_channels', topic: trendingTopic, platform: 'facebook', source: 'google' },
      }),
      r2Storage.uploadFile(pngBuffer, `${baseFileName}-instagram.png`, {
        contentType: 'image/png',
        metadata: { category: 'tv_channels', topic: trendingTopic, platform: 'instagram', source: 'google' },
      }),
      r2Storage.uploadFile(webpBuffer, `${baseFileName}-tiktok.webp`, {
        contentType: 'image/webp',
        metadata: { category: 'tv_channels', topic: trendingTopic, platform: 'tiktok', source: 'google' },
      }),
    ]);

    console.log(`✅ TV Channel poster uploaded successfully`);

    const metadata: PosterImageMetadata = {
      category: 'tv_channels',
      trendingTerm: trendingTopic,
      imageUrl: pngUrl,
      isEdited: false,
      platformTargets: ['Facebook', 'Instagram', 'TikTok'],
    };

    return {
      pngUrl,
      webpUrl,
      facebookPngUrl: fbPngUrl,
      instagramPngUrl: igPngUrl,
      tiktokWebpUrl,
      trendingTopic,
      posterTitle: trendingTopic,
      sourceImageUrl: (imageResult as any).generatedBuffer ? 'generated' : imageResult.imageUrl,
      metadata,
      descriptionAr: promoAr,
      descriptionEn: promoEn,
    };
  }

  private async createTVChannelOverlay(
    imageBuffer: Buffer,
    channelName: string,
    promoAr: string,
    promoEn: string
  ): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    const resizedImage = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .toBuffer();

    const nameLines = this.wrapText(channelName, 16, 3).map(line => escapeXml(line));
    const promoArLines = this.wrapText(promoAr, 28, 4).map(line => escapeXml(line));
    const promoEnLines = this.wrapText(promoEn, 35, 4).map(line => escapeXml(line));
    const channelInitials = escapeXml(this.getGameInitials(channelName));

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="20%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.85);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="purpleBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="redLiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4338ca;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0d9488;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#14b8a6;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="tvGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="titleGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Top gradient for header -->
        <rect x="0" y="0" width="${width}" height="520" fill="url(#topGrad)"/>
        
        <!-- Bottom gradient for content - Extended for 4 lines -->
        <rect x="0" y="${height - 750}" width="${width}" height="750" fill="url(#bottomGrad)"/>
        
        <!-- LIVE Badge with blinking effect -->
        <rect x="${width / 2 - 60}" y="25" width="120" height="35" rx="17" fill="url(#redLiveGrad)" filter="url(#shadow)"/>
        <circle cx="${width / 2 - 35}" cy="42" r="6" fill="white"/>
        <text x="${width / 2 + 10}" y="48" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">
          LIVE
        </text>
        
        <!-- TV Icon Circle -->
        <rect x="${width / 2 - 55}" y="75" width="110" height="90" rx="12" fill="url(#purpleBlueGrad)" filter="url(#shadow)"/>
        <rect x="${width / 2 - 50}" y="80" width="100" height="80" rx="10" fill="url(#indigoGrad)"/>
        <text x="${width / 2}" y="135" font-family="Arial, sans-serif" font-size="45" fill="white" text-anchor="middle">
          📺
        </text>
        
        <!-- TRENDING Badge -->
        <rect x="${width / 2 - 120}" y="180" width="240" height="42" rx="21" fill="url(#goldGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="208" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle">
          TRENDING CHANNEL
        </text>
        
        <!-- Channel Name with prominent display -->
        <rect x="30" y="240" width="${width - 60}" height="${nameLines.length * 62 + 45}" rx="20" fill="rgba(0,0,0,0.7)" filter="url(#shadow)"/>
        ${nameLines.map((line, index) => `
        <text x="${width / 2}" y="${290 + (index * 62)}" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="white" text-anchor="middle" filter="url(#titleGlow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- Arabic Channel Label -->
        <rect x="${width / 2 - 100}" y="${300 + (nameLines.length * 62)}" width="200" height="48" rx="24" fill="url(#purpleBlueGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${332 + (nameLines.length * 62)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          قناة ترند الآن
        </text>
        
        <!-- Arabic Promotional Text - 4 Lines (raised by 170px) -->
        <rect x="35" y="${height - 770}" width="${width - 70}" height="${promoArLines.length * 42 + 45}" rx="22" fill="rgba(79,70,229,0.95)" filter="url(#shadow)"/>
        ${promoArLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 735 + (index * 42)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text - 4 Lines (raised by 170px) -->
        ${promoEnLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 550 + (index * 38)}" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.95)" text-anchor="middle" font-style="italic">
          "${line}"
        </text>
        `).join('')}
        
        <!-- WATCH LIVE CTA Button - Professional TV Style - Positioned higher for Facebook Story visibility (raised by 170px) -->
        <rect x="${width / 2 - 250}" y="${height - 450}" width="500" height="135" rx="25" fill="url(#tealGrad)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${height - 393}" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#tvGlow)">
          ${TV_CHANNELS_CTA_AR}
        </text>
        <text x="${width / 2}" y="${height - 345}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">
          ${TV_CHANNELS_CTA_EN}
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    return await sharp(resizedImage)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .toBuffer();
  }

  private async downloadImage(url: string): Promise<Buffer> {
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      return await this.validateAndConvertImage(buffer);
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (contentType.includes('svg') || this.isSvgBuffer(buffer)) {
      throw new Error('SVG images are not supported, trying next image');
    }
    
    if (contentType.includes('html') || this.isHtmlBuffer(buffer)) {
      throw new Error('Received HTML instead of image, trying next image');
    }

    return await this.validateAndConvertImage(buffer);
  }

  private isSvgBuffer(buffer: Buffer): boolean {
    const header = buffer.slice(0, 500).toString('utf-8').toLowerCase();
    return header.includes('<svg') || header.includes('<?xml');
  }

  private isHtmlBuffer(buffer: Buffer): boolean {
    const header = buffer.slice(0, 500).toString('utf-8').toLowerCase();
    return header.includes('<html') || header.includes('<!doctype');
  }

  private async validateAndConvertImage(buffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      if (!metadata.format || !['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'].includes(metadata.format)) {
        throw new Error(`Unsupported image format: ${metadata.format}`);
      }
      
      return await image
        .png()
        .toBuffer();
    } catch (error: any) {
      if (error.message.includes('corrupt') || error.message.includes('XML') || error.message.includes('parse')) {
        throw new Error('Image is corrupted or in unsupported format');
      }
      throw error;
    }
  }

  private async processImageForStories(
    imageBuffer: Buffer,
    title: string,
    category: typeof storyCategories[number],
    latestEpisode?: number,
    descriptionEn?: string,
    descriptionAr?: string
  ): Promise<{
    pngBuffer: Buffer;
    webpBuffer: Buffer;
    facebookPngBuffer: Buffer;
    instagramPngBuffer: Buffer;
    tiktokWebpBuffer: Buffer;
  }> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const storyImage = await this.createStoryImage(imageBuffer, metadata.width || 800, metadata.height || 1200);

    let processedImage = storyImage;
    if (category === 'tv_shows' && latestEpisode !== undefined) {
      processedImage = await this.addEpisodeOverlay(storyImage, latestEpisode, title, descriptionEn, descriptionAr);
    } else {
      processedImage = await this.addTitleOverlay(storyImage, title, category, descriptionEn, descriptionAr);
    }

    const [pngBuffer, webpBuffer] = await Promise.all([
      sharp(processedImage)
        .png({ quality: 95 })
        .toBuffer(),
      sharp(processedImage)
        .webp({ quality: 90 })
        .toBuffer(),
    ]);

    const facebookPngBuffer = await sharp(processedImage)
      .resize(1080, 1920, { fit: 'cover', position: 'center' })
      .png({ quality: 95 })
      .toBuffer();

    const instagramPngBuffer = await sharp(processedImage)
      .resize(1080, 1920, { fit: 'cover', position: 'center' })
      .png({ quality: 95 })
      .toBuffer();

    const tiktokWebpBuffer = await sharp(processedImage)
      .resize(1080, 1920, { fit: 'cover', position: 'center' })
      .webp({ quality: 90 })
      .toBuffer();

    return {
      pngBuffer,
      webpBuffer,
      facebookPngBuffer,
      instagramPngBuffer,
      tiktokWebpBuffer,
    };
  }

  private async createStoryImage(imageBuffer: Buffer, originalWidth: number, originalHeight: number): Promise<Buffer> {
    const targetWidth = STORY_DIMENSIONS.width;
    const targetHeight = STORY_DIMENSIONS.height;

    const resizedImage = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();

    return resizedImage;
  }

  private async addEpisodeOverlay(imageBuffer: Buffer, episode: number, title: string, descriptionEn?: string, descriptionAr?: string): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    const episodeText = `الحلقة ${episode}`;
    const episodeTextEn = `Episode ${episode}`;
    
    const ctaAr = 'شاهد الآن';
    const ctaEn = 'WATCH NOW';
    
    const promoTextAr = descriptionAr || 'مسلسل رائع يستحق المشاهدة من الحلقة الأولى! أحداث مثيرة وتشويق لا ينتهي. لا تفوت هذه التحفة الفنية المذهلة';
    
    const promoTextEn = descriptionEn || 'An amazing series worth watching from episode one! Thrilling events and endless suspense. Don\'t miss this stunning masterpiece';
    
    const titleLines = this.wrapText(title, 16, 3);
    const arabicLines = this.wrapText(promoTextAr, 28, 4);
    const englishLines = this.wrapText(promoTextEn, 35, 4);

    console.log(`🎨 Creating episode overlay for "${title}" - Episode ${episode}`);
    console.log(`   Arabic text (${arabicLines.length} lines): "${promoTextAr.substring(0, 80)}..."`);
    console.log(`   English text (${englishLines.length} lines): "${promoTextEn.substring(0, 80)}..."`);
    console.log(`   CTA: ${ctaAr} / ${ctaEn}`);

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.6);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="20%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.85);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="arabicGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:rgba(124,58,237,0.95);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(139,92,246,0.95);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(124,58,237,0.95);stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
          <filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.9)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="titleGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Top gradient overlay -->
        <rect x="0" y="0" width="${width}" height="520" fill="url(#topGradient)"/>
        
        <!-- Extended bottom gradient for bilingual content - 4 lines -->
        <rect x="0" y="${height - 750}" width="${width}" height="750" fill="url(#bottomGradient)"/>
        
        <!-- NEW EPISODE Badge -->
        <rect x="${width / 2 - 120}" y="25" width="240" height="38" rx="19" fill="url(#redGradient)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="50" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">
          NEW EPISODE
        </text>
        
        <!-- Episode Number Badge (Bilingual) -->
        <rect x="${width / 2 - 150}" y="75" width="300" height="80" rx="40" fill="url(#badgeGradient)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="110" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${episodeText}
        </text>
        <text x="${width / 2}" y="142" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.9)" text-anchor="middle">
          ${episodeTextEn}
        </text>
        
        <!-- Series Title with prominent display -->
        <rect x="30" y="175" width="${width - 60}" height="${titleLines.length * 62 + 45}" rx="20" fill="rgba(0,0,0,0.7)" filter="url(#shadow)"/>
        ${titleLines.map((line, index) => `
        <text x="${width / 2}" y="${225 + (index * 62)}" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="white" text-anchor="middle" filter="url(#titleGlow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- Arabic Series Label -->
        <rect x="${width / 2 - 100}" y="${235 + (titleLines.length * 62)}" width="200" height="48" rx="24" fill="url(#badgeGradient)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${267 + (titleLines.length * 62)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" filter="url(#glow)">
          مسلسل جديد
        </text>
        
        <!-- Arabic Promotional Text Section - 4 Lines (raised by 170px) -->
        <rect x="35" y="${height - 770}" width="${width - 70}" height="${arabicLines.length * 42 + 45}" rx="22" fill="url(#arabicGradient)" filter="url(#shadow)"/>
        ${arabicLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 735 + (index * 42)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text Section - 4 Lines (raised by 170px) -->
        ${englishLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 550 + (index * 38)}" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.95)" text-anchor="middle" filter="url(#textShadow)" font-style="italic">
          "${line}"
        </text>
        `).join('')}
        
        <!-- Call-to-Action Button (Bilingual) - Positioned higher for Facebook Story visibility (raised by 170px) -->
        <rect x="${width / 2 - 220}" y="${height - 450}" width="440" height="135" rx="25" fill="url(#badgeGradient)" filter="url(#shadow)"/>
        <text x="${width / 2}" y="${height - 393}" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="white" text-anchor="middle" direction="rtl" filter="url(#glow)">
          ${ctaAr}
        </text>
        <text x="${width / 2}" y="${height - 345}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">
          ${ctaEn}
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    const result = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .composite([
        {
          input: overlayBuffer,
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    return result;
  }

  private wrapText(text: string, maxCharsPerLine: number, maxLines: number = 4): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.slice(0, maxLines);
  }

  private async addTitleOverlay(imageBuffer: Buffer, title: string, category: typeof storyCategories[number], descriptionEn?: string, descriptionAr?: string): Promise<Buffer> {
    const width = STORY_DIMENSIONS.width;
    const height = STORY_DIMENSIONS.height;

    const categoryLabels: Record<typeof storyCategories[number], { en: string; ar: string }> = {
      'movies': { en: 'MOVIE', ar: 'فيلم' },
      'tv_shows': { en: 'SERIES', ar: 'مسلسل' },
      'sports': { en: 'SPORTS', ar: 'رياضة' },
      'recipes': { en: 'RECIPE', ar: 'وصفة' },
      'gaming': { en: 'GAMING', ar: 'ألعاب' },
      'apps': { en: 'APP', ar: 'تطبيق' },
      'tv_channels': { en: 'TV CHANNEL', ar: 'قناة تلفزيونية' },
    };

    const categoryColors: Record<typeof storyCategories[number], { primary: string; secondary: string }> = {
      'movies': { primary: '#dc2626', secondary: '#e11d48' },
      'tv_shows': { primary: '#7c3aed', secondary: '#8b5cf6' },
      'sports': { primary: '#059669', secondary: '#10b981' },
      'recipes': { primary: '#ea580c', secondary: '#f97316' },
      'gaming': { primary: '#2563eb', secondary: '#3b82f6' },
      'apps': { primary: '#0891b2', secondary: '#06b6d4' },
      'tv_channels': { primary: '#4f46e5', secondary: '#6366f1' },
    };

    const ctaMessages: Record<typeof storyCategories[number], { ar: string; en: string }> = {
      'movies': { ar: 'شاهد الآن', en: 'WATCH NOW' },
      'tv_shows': { ar: 'تابع المسلسل', en: 'FOLLOW THE SERIES' },
      'sports': { ar: 'لا تفوت المباراة', en: 'DON\'T MISS IT' },
      'recipes': { ar: 'جرب الوصفة', en: 'TRY THE RECIPE' },
      'gaming': { ar: 'العب الآن', en: 'PLAY NOW' },
      'apps': { ar: 'حمّل التطبيق', en: 'DOWNLOAD NOW' },
      'tv_channels': { ar: 'شاهد البث المباشر', en: 'WATCH LIVE' },
    };

    const arabicDefaultDescriptions: Record<typeof storyCategories[number], string[]> = {
      'movies': ['فيلم رائع يستحق المشاهدة! لا تفوت هذه التحفة السينمائية', 'أفضل فيلم في الموسم! شاهده الآن', 'فيلم مذهل سيأسر قلبك من البداية للنهاية'],
      'tv_shows': ['مسلسل رائع يستحق المشاهدة! لا تفوت أحداثه المثيرة', 'أفضل مسلسل في الموسم! شاهده الآن', 'مسلسل مذهل سيجعلك تنتظر كل حلقة بفارغ الصبر'],
      'sports': ['مباراة نارية لا تفوتها! أفضل لحظات الرياضة', 'حدث رياضي تاريخي! شاهد الإثارة', 'المباراة التي ينتظرها الجميع! لا تفوتها'],
      'recipes': ['وصفة شهية وسهلة التحضير! جربها الآن', 'أشهى الأطباق في متناول يدك! وصفة رائعة', 'طبق لذيذ سيبهر عائلتك وأصدقائك'],
      'gaming': ['لعبة مذهلة تستحق التجربة! انضم للمغامرة', 'أفضل لعبة في الموسم! جربها الآن', 'عالم جديد من المتعة والإثارة ينتظرك'],
      'apps': ['تطبيق رائع سيغير حياتك! حمله الآن', 'أفضل تطبيق في الفئة! لا تفوته', 'تطبيق مذهل يستحق التجربة فوراً'],
      'tv_channels': ['قناة تلفزيونية مميزة! شاهد البث المباشر', 'أفضل القنوات التلفزيونية! لا تفوت البرامج', 'محتوى حصري ومميز على هذه القناة'],
    };

    const englishDefaultDescriptions: Record<typeof storyCategories[number], string[]> = {
      'movies': ['A masterpiece worth watching! Don\'t miss this cinematic gem', 'Best movie of the season! Watch it now', 'An amazing film that will captivate you from start to finish'],
      'tv_shows': ['An amazing series worth watching! Don\'t miss the exciting events', 'Best series of the season! Watch now', 'A show that will keep you waiting for every episode'],
      'sports': ['An epic match you can\'t miss! Best sports moments', 'Historic sports event! Watch the excitement', 'The match everyone is waiting for! Don\'t miss it'],
      'recipes': ['Delicious and easy to make! Try it now', 'Amazing dishes at your fingertips! Great recipe', 'A tasty dish that will impress your family'],
      'gaming': ['An amazing game worth trying! Join the adventure', 'Best game of the season! Try it now', 'A new world of fun and excitement awaits you'],
      'apps': ['A great app that will change your life! Download now', 'Best app in its category! Don\'t miss it', 'An amazing app worth trying immediately'],
      'tv_channels': ['A premium TV channel! Watch live now', 'The best TV channels! Don\'t miss the shows', 'Exclusive and premium content on this channel'],
    };

    const categoryLabel = categoryLabels[category];
    const colors = categoryColors[category];
    const cta = ctaMessages[category];
    
    const promoTextAr = descriptionAr || arabicDefaultDescriptions[category][Math.floor(Math.random() * arabicDefaultDescriptions[category].length)];
    
    const promoTextEn = descriptionEn || englishDefaultDescriptions[category][Math.floor(Math.random() * englishDefaultDescriptions[category].length)];
    
    const arabicLines = this.wrapText(promoTextAr, 28, 4);
    const englishLines = this.wrapText(promoTextEn, 35, 4);

    console.log(`🎨 Creating poster overlay for ${category}`);
    console.log(`   Arabic text (${arabicLines.length} lines): "${promoTextAr.substring(0, 80)}..."`);
    console.log(`   English text (${englishLines.length} lines): "${promoTextEn.substring(0, 80)}..."`);
    console.log(`   CTA: ${cta.ar} / ${cta.en}`);

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0.95);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
            <stop offset="20%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.85);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
          </linearGradient>
          <linearGradient id="categoryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="arabicGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${colors.primary}e6;stop-opacity:1" />
            <stop offset="50%" style="stop-color:${colors.secondary}e6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.primary}e6;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
          </linearGradient>
          <filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.9)"/>
          </filter>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(0,0,0,0.95)"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Top gradient -->
        <rect x="0" y="0" width="${width}" height="300" fill="url(#topGrad)"/>
        
        <!-- Extended bottom gradient for bilingual promotional content - 4 lines -->
        <rect x="0" y="${height - 680}" width="${width}" height="680" fill="url(#bottomGrad)"/>
        
        <!-- Category badge at top (bilingual) -->
        <rect x="${width / 2 - 130}" y="45" width="260" height="75" rx="37" fill="url(#categoryGradient)" filter="url(#shadow)"/>
        <rect x="${width / 2 - 125}" y="50" width="250" height="65" rx="32" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
        <text x="${width / 2}" y="75" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">
          ${categoryLabel.ar}
        </text>
        <text x="${width / 2}" y="102" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.9)" text-anchor="middle" dominant-baseline="middle">
          ${categoryLabel.en}
        </text>
        
        <!-- Arabic Promotional Text Section - 4 Lines -->
        <rect x="35" y="${height - 560}" width="${width - 70}" height="${arabicLines.length * 42 + 45}" rx="22" fill="url(#arabicGradient)" filter="url(#shadow)"/>
        ${arabicLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 525 + (index * 42)}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" direction="rtl" filter="url(#glow)">
          ${line}
        </text>
        `).join('')}
        
        <!-- English Promotional Text Section - 4 Lines -->
        ${englishLines.map((line, index) => `
        <text x="${width / 2}" y="${height - 340 + (index * 38)}" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.95)" text-anchor="middle" dominant-baseline="middle" filter="url(#textShadow)" font-style="italic">
          "${line}"
        </text>
        `).join('')}
        
        <!-- Call-to-Action Button (bilingual) - Positioned higher for Facebook Story visibility -->
        <rect x="${width / 2 - 200}" y="${height - 270}" width="400" height="125" rx="25" fill="url(#categoryGradient)" filter="url(#shadow)"/>
        <rect x="${width / 2 - 195}" y="${height - 265}" width="390" height="115" rx="22" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <text x="${width / 2}" y="${height - 220}" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" direction="rtl" filter="url(#glow)">
          ${cta.ar}
        </text>
        <text x="${width / 2}" y="${height - 175}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle" dominant-baseline="middle">
          ${cta.en}
        </text>
      </svg>
    `;

    const overlayBuffer = Buffer.from(svgOverlay);

    const result = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .composite([
        {
          input: overlayBuffer,
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    return result;
  }
}

export const trendingPosterService = new TrendingPosterService();
