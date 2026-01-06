import { z } from "zod";

// User Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  company?: string;
  createdAt: Date;
}

export type InsertUser = Omit<User, 'id' | 'createdAt'>;

// Story Types
export const storyCategories = [
  "movies",
  "tv_shows",
  "sports",
  "recipes",
  "gaming",
  "apps",
  "tv_channels",
  "news",
  "technology",
  "health",
  "travel",
  "education"
] as const;

export const categoryLabels: Record<typeof storyCategories[number], string> = {
  movies: "أفلام",
  tv_shows: "مسلسلات",
  sports: "رياضة",
  recipes: "وصفات طبخ",
  gaming: "ألعاب",
  apps: "تطبيقات",
  tv_channels: "قنوات تلفزيونية",
  news: "أخبار",
  technology: "تقنية",
  health: "صحة",
  travel: "سفر",
  education: "تعليم"
};

export const platforms = ["facebook", "instagram", "tiktok"] as const;

export const storyStatus = ["draft", "scheduled", "published", "failed"] as const;

export const videoGenerationStatus = ["pending", "generating", "generated", "error"] as const;

export const storyFormats = ["story", "feed", "reel"] as const;

export interface Story {
  id: string;
  userId: string;
  content: string;
  category: typeof storyCategories[number];
  platforms: (typeof platforms[number])[];
  publishedPlatforms?: (typeof platforms[number])[];
  scheduledTime: Date;
  status: typeof storyStatus[number];
  format: typeof storyFormats[number];
  mediaUrl?: string;
  jpegUrl?: string;
  webpUrl?: string;
  mediaType?: "image" | "video";
  trendingTopic?: string;
  posterTitle?: string;
  latestEpisode?: number;
  sourceImageUrl?: string;
  facebookPngUrl?: string;
  instagramPngUrl?: string;
  tiktokWebpUrl?: string;
  processedAt?: Date;
  musicUrl?: string;
  musicTitle?: string;
  musicArtist?: string;
  musicThumbnail?: string;
  musicDuration?: number;
  musicVideoId?: string;
  videoDuration?: number;
  originCountry?: string;
  engagementRate?: number;
  publishedAt?: Date;
  likes?: number;
  shares?: number;
  comments?: number;
  views?: number;
  hashtags?: string[];
  videoUrl?: string;
  videoGenerationStatus?: typeof videoGenerationStatus[number];
  videoGeneratedAt?: Date;
  videoScheduledGenerationTime?: Date;
  videoStorageKey?: string;
  videoContentType?: string;
  videoFileSize?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const insertStorySchema = z.object({
  content: z.string().min(1, "المحتوى مطلوب").max(500, "الحد الأقصى 500 حرف"),
  category: z.enum(storyCategories),
  platforms: z.array(z.enum(platforms)).min(1, "يجب اختيار منصة واحدة على الأقل"),
  scheduledTime: z.string().or(z.date()),
  format: z.enum(storyFormats).default("story"),
  mediaUrl: z.string().optional(),
  jpegUrl: z.string().optional(),
  webpUrl: z.string().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  trendingTopic: z.string().optional(),
  posterTitle: z.string().optional(),
  latestEpisode: z.number().optional(),
  sourceImageUrl: z.string().optional(),
  facebookPngUrl: z.string().optional(),
  instagramPngUrl: z.string().optional(),
  tiktokWebpUrl: z.string().optional(),
  musicUrl: z.string().optional(),
  musicTitle: z.string().optional(),
  musicArtist: z.string().optional(),
  musicThumbnail: z.string().optional(),
  musicDuration: z.number().optional(),
  musicVideoId: z.string().optional(),
  videoDuration: z.number().optional(),
  originCountry: z.string().optional(),
  videoUrl: z.string().optional(),
  videoGenerationStatus: z.enum(videoGenerationStatus).optional(),
  videoGeneratedAt: z.date().optional(),
  videoScheduledGenerationTime: z.date().optional(),
  videoStorageKey: z.string().optional(),
  videoContentType: z.string().optional(),
  videoFileSize: z.number().optional(),
}).refine((data) => {
  if (data.mediaUrl && !data.mediaUrl.startsWith('http://') && !data.mediaUrl.startsWith('https://')) {
    return false;
  }
  if (data.jpegUrl && !data.jpegUrl.startsWith('http://') && !data.jpegUrl.startsWith('https://')) {
    return false;
  }
  if (data.webpUrl && !data.webpUrl.startsWith('http://') && !data.webpUrl.startsWith('https://')) {
    return false;
  }
  return true;
}, {
  message: "يجب أن يكون رابط الوسائط رابطاً صالحاً يبدأ بـ http:// أو https://",
  path: ["mediaUrl"],
});

export type InsertStory = z.infer<typeof insertStorySchema>;

export const updateStorySchema = z.object({
  content: z.string().min(1).max(500).optional(),
  category: z.enum(storyCategories).optional(),
  platforms: z.array(z.enum(platforms)).min(1).optional(),
  publishedPlatforms: z.array(z.enum(platforms)).optional(),
  scheduledTime: z.string().or(z.date()).optional(),
  format: z.enum(storyFormats).optional(),
  mediaUrl: z.string().optional(),
  jpegUrl: z.string().optional(),
  webpUrl: z.string().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  trendingTopic: z.string().optional(),
  posterTitle: z.string().optional(),
  latestEpisode: z.number().optional(),
  sourceImageUrl: z.string().optional(),
  facebookPngUrl: z.string().optional(),
  instagramPngUrl: z.string().optional(),
  tiktokWebpUrl: z.string().optional(),
  musicUrl: z.string().optional(),
  musicTitle: z.string().optional(),
  musicArtist: z.string().optional(),
  musicThumbnail: z.string().optional(),
  musicDuration: z.number().optional(),
  musicVideoId: z.string().optional(),
  videoDuration: z.number().optional(),
  originCountry: z.string().optional(),
  videoUrl: z.string().optional(),
  videoGenerationStatus: z.enum(videoGenerationStatus).optional(),
  videoGeneratedAt: z.date().optional(),
  videoScheduledGenerationTime: z.date().optional(),
  videoStorageKey: z.string().optional(),
  videoContentType: z.string().optional(),
  videoFileSize: z.number().optional(),
  status: z.enum(storyStatus).optional(),
}).refine((data) => {
  if (data.mediaUrl && !data.mediaUrl.startsWith('http://') && !data.mediaUrl.startsWith('https://')) {
    return false;
  }
  if (data.jpegUrl && !data.jpegUrl.startsWith('http://') && !data.jpegUrl.startsWith('https://')) {
    return false;
  }
  if (data.webpUrl && !data.webpUrl.startsWith('http://') && !data.webpUrl.startsWith('https://')) {
    return false;
  }
  return true;
}, {
  message: "يجب أن يكون رابط الوسائط رابطاً صالحاً يبدأ بـ http:// أو https://",
  path: ["mediaUrl"],
});

export type UpdateStory = z.infer<typeof updateStorySchema>;

// Analytics Types
export interface PlatformAnalytics {
  platform: typeof platforms[number];
  totalStories: number;
  publishedStories: number;
  averageEngagement: number;
}

export interface CategoryAnalytics {
  category: typeof storyCategories[number];
  count: number;
  averageEngagement: number;
}

export interface TimeAnalytics {
  date: string;
  published: number;
  engagement: number;
}

// Content Generator Types
export interface ContentGeneratorRequest {
  category: typeof storyCategories[number];
  keywords?: string;
}

export interface ContentGeneratorResponse {
  content: string;
  category: typeof storyCategories[number];
}

// Settings Types
export interface UserSettings {
  userId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  publicProfile: boolean;
  showActivity: boolean;
  autoPublish: boolean;
  preferredPublishTime: string;
  autoStoryGenerationEnabled?: boolean;
  autoStoryGenerationTime?: string;
  autoStoryCategories?: (typeof storyCategories[number])[];
  autoStoryPlatforms?: (typeof platforms[number])[];
  autoStoryFormat?: typeof storyFormats[number];
  autoStoryWithMusic?: boolean;
  autoStoryWithVideo?: boolean;
}

export interface AutoStoryGenerationSettings {
  enabled: boolean;
  publishTime: string; // HH:mm format
  categories: (typeof storyCategories[number])[];
  platforms: (typeof platforms[number])[];
  format: typeof storyFormats[number];
  withMusic: boolean;
  withVideo: boolean;
  scheduleVideoGenerationInAdvance?: boolean;
  videoGenerationHoursBefore?: number; // e.g., 2 hours before publish
}

export const updateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  publicProfile: z.boolean().optional(),
  showActivity: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  preferredPublishTime: z.string().optional(),
  autoStoryGenerationEnabled: z.boolean().optional(),
  autoStoryGenerationTime: z.string().optional(),
  autoStoryCategories: z.array(z.enum(storyCategories)).optional(),
  autoStoryPlatforms: z.array(z.enum(platforms)).optional(),
  autoStoryFormat: z.enum(storyFormats).optional(),
  autoStoryWithMusic: z.boolean().optional(),
  autoStoryWithVideo: z.boolean().optional(),
});

export const autoStoryGenerationSettingsSchema = z.object({
  enabled: z.boolean(),
  publishTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  categories: z.array(z.enum(storyCategories)).min(1),
  platforms: z.array(z.enum(platforms)).min(1),
  format: z.enum(storyFormats),
  withMusic: z.boolean(),
  withVideo: z.boolean(),
  scheduleVideoGenerationInAdvance: z.boolean().optional(),
  videoGenerationHoursBefore: z.number().optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// Admin Types
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  storiesCount: number;
  createdAt: Date;
  status: "active" | "suspended";
}

export interface PlatformIntegration {
  platform: typeof platforms[number];
  enabled: boolean;
  moderationEnabled: boolean;
  lastError?: string;
  lastHealthCheck?: Date;
  performanceScore?: number;
}

// API Management Types
export const apiProviders = ["facebook", "instagram", "tiktok", "deepseek", "cloudflare_r2", "youtube", "huggingface", "gemini", "google_trends", "rapidapi", "tmdb", "github_actions"] as const;

export interface APIConfig {
  provider: typeof apiProviders[number];
  apiKey?: string;
  appId?: string;
  appSecret?: string;
  redirectUrl?: string;
  additionalConfig?: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    searchEngineId?: string;
    replit_app_url?: string;
    cron_secret_key?: string;
  };
  isConnected: boolean;
  lastTested?: Date;
}

export const insertAPIConfigSchema = z.object({
  provider: z.enum(apiProviders),
  apiKey: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  additionalConfig: z.object({
    accountId: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    bucketName: z.string().optional(),
    searchEngineId: z.string().optional(),
    replit_app_url: z.string().optional(),
    cron_secret_key: z.string().optional(),
  }).optional(),
});

export type InsertAPIConfig = z.infer<typeof insertAPIConfigSchema>;

export const updateAPIConfigSchema = z.object({
  apiKey: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  additionalConfig: z.object({
    accountId: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    bucketName: z.string().optional(),
    searchEngineId: z.string().optional(),
    replit_app_url: z.string().optional(),
    cron_secret_key: z.string().optional(),
  }).optional(),
  isConnected: z.boolean().optional(),
  lastTested: z.date().optional(),
});

export type UpdateAPIConfig = z.infer<typeof updateAPIConfigSchema>;

// Linked Accounts Types
export const accountPlatforms = ["facebook", "instagram", "tiktok"] as const;
export const accountStatus = ["active", "inactive", "expired", "error"] as const;
export const accountTypes = ["page", "profile", "business"] as const;

export interface LinkedAccount {
  id: string;
  userId: string;
  platform: typeof accountPlatforms[number];
  accountType: typeof accountTypes[number];
  externalId: string;
  name: string;
  username?: string;
  profilePictureUrl?: string;
  status: typeof accountStatus[number];
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  permissions: string[];
  capabilities: PlatformCapabilities;
  targeting?: AccountTargeting;
  quotas: AccountQuotas;
  lastSyncedAt?: Date;
  lastPublishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformCapabilities {
  canPublishStories: boolean;
  canPublishPosts: boolean;
  canPublishReels: boolean;
  canSchedule: boolean;
  canGetInsights: boolean;
  maxVideoSize?: number;
  maxImageSize?: number;
  supportedFormats?: string[];
}

export interface AccountTargeting {
  defaultAudience?: "public" | "friends" | "custom";
  ageRange?: { min: number; max: number };
  locations?: string[];
  interests?: string[];
  language?: string;
}

export interface AccountQuotas {
  dailyLimit: number;
  dailyUsed: number;
  monthlyLimit: number;
  monthlyUsed: number;
  resetAt: Date;
}

export const insertLinkedAccountSchema = z.object({
  platform: z.enum(accountPlatforms),
  accountType: z.enum(accountTypes),
  externalId: z.string().min(1, "معرف الحساب مطلوب"),
  name: z.string().min(1, "اسم الحساب مطلوب"),
  username: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  accessToken: z.string().min(1, "رمز الدخول مطلوب"),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.date().optional(),
  permissions: z.array(z.string()).default([]),
  capabilities: z.object({
    canPublishStories: z.boolean().default(false),
    canPublishPosts: z.boolean().default(false),
    canPublishReels: z.boolean().default(false),
    canSchedule: z.boolean().default(false),
    canGetInsights: z.boolean().default(false),
    maxVideoSize: z.number().optional(),
    maxImageSize: z.number().optional(),
    supportedFormats: z.array(z.string()).optional(),
  }),
  targeting: z.object({
    defaultAudience: z.enum(["public", "friends", "custom"]).optional(),
    ageRange: z.object({ min: z.number(), max: z.number() }).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    language: z.string().optional(),
  }).optional(),
});

export type InsertLinkedAccount = z.infer<typeof insertLinkedAccountSchema>;

export const updateLinkedAccountSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  status: z.enum(accountStatus).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.date().optional(),
  permissions: z.array(z.string()).optional(),
  capabilities: z.object({
    canPublishStories: z.boolean().optional(),
    canPublishPosts: z.boolean().optional(),
    canPublishReels: z.boolean().optional(),
    canSchedule: z.boolean().optional(),
    canGetInsights: z.boolean().optional(),
    maxVideoSize: z.number().optional(),
    maxImageSize: z.number().optional(),
    supportedFormats: z.array(z.string()).optional(),
  }).optional(),
  targeting: z.object({
    defaultAudience: z.enum(["public", "friends", "custom"]).optional(),
    ageRange: z.object({ min: z.number(), max: z.number() }).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    language: z.string().optional(),
  }).optional(),
  lastSyncedAt: z.date().optional(),
  lastPublishedAt: z.date().optional(),
});

export type UpdateLinkedAccount = z.infer<typeof updateLinkedAccountSchema>;

// Account Assignment to Stories
export interface StoryAccountAssignment {
  storyId: string;
  accountId: string;
  assignedAt: Date;
  publishedAt?: Date;
  status: "pending" | "published" | "failed";
  error?: string;
}

export const insertStoryAccountAssignmentSchema = z.object({
  storyId: z.string().min(1),
  accountId: z.string().min(1),
});

export type InsertStoryAccountAssignment = z.infer<typeof insertStoryAccountAssignmentSchema>;

// User Account Stats
export interface UserAccountStats {
  userId: string;
  totalAccounts: number;
  facebookAccounts: number;
  instagramAccounts: number;
  tiktokAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  maxAccounts: number;
  totalFollowers?: number;
  totalPosts?: number;
  avgEngagement?: number;
  totalReach?: number;
  growthRate?: number;
  updatedAt: Date;
}

// Smart Recommendations Types
export interface BestTimeRecommendation {
  dayOfWeek: number;
  hour: number;
  dayName: string;
  timeSlot: string;
  averageEngagement: number;
  postCount: number;
  confidence: number;
}

export interface ContentRecommendation {
  category: typeof storyCategories[number];
  suggestedContent: string;
  reasoning: string;
  expectedEngagement: number;
  suggestedHashtags: string[];
  suggestedPlatforms: (typeof platforms[number])[];
  suggestedTime?: Date;
}

export interface PlatformRecommendation {
  platforms: (typeof platforms[number])[];
  reasoning: string;
  expectedEngagement: Record<string, number>;
}

export interface TrendingHashtag {
  hashtag: string;
  usageCount: number;
  averageEngagement: number;
  category?: typeof storyCategories[number];
  trending: boolean;
}

export interface SmartInsights {
  bestPostingTimes: BestTimeRecommendation[];
  topPerformingCategories: {
    category: typeof storyCategories[number];
    averageEngagement: number;
    postCount: number;
  }[];
  platformPerformance: {
    platform: typeof platforms[number];
    averageEngagement: number;
    bestTime?: string;
  }[];
  trendingHashtags: TrendingHashtag[];
  contentSuggestions: string[];
}

// YouTube Music Types
export interface YouTubeMusicSearchResult {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  url: string;
}

export interface YouTubeMusicSearchRequest {
  query: string;
  limit?: number;
}

export interface YouTubeMusicSearchResponse {
  results: YouTubeMusicSearchResult[];
}

// Trending Content JSON Schemas
export interface TrendQueryResult {
  topic: string;
  category: typeof storyCategories[number];
  rank: number;
  country: string;
  countryPriority: number;
  searchVolume?: number;
  relatedQueries?: string[];
  timestamp: Date;
}

export interface PosterImageMetadata {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  source: 'google' | 'tmdb' | 'placeholder';
  category: typeof storyCategories[number];
  width: number;
  height: number;
  format: 'png' | 'webp' | 'jpeg';
  size: number;
  r2Key: string;
  publicUrl: string;
  episode?: number;
  trendingTopic?: string;
  createdAt: Date;
}

export interface StoryScheduleItem {
  id: string;
  storyId: string;
  platform: typeof platforms[number];
  scheduledTime: Date;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  imageFormat: 'png' | 'webp';
  imageUrl: string;
  content: string;
  category: typeof storyCategories[number];
  trendingTopic?: string;
  posterTitle?: string;
  latestEpisode?: number;
  retryCount: number;
  lastError?: string;
  publishedAt?: Date;
  publishedId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
  };
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: {
    processingTime: number;
    timestamp: Date;
  };
}

export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;

// Country Priority Configuration for TV Shows
export interface CountryPriorityConfig {
  country: string;
  code: string;
  priority: number;
  enabled: boolean;
}

export const DEFAULT_TV_COUNTRY_PRIORITIES: CountryPriorityConfig[] = [
  { country: 'Turkey', code: 'TR', priority: 1, enabled: true },
  { country: 'United States', code: 'US', priority: 2, enabled: true },
  { country: 'India', code: 'IN', priority: 3, enabled: true },
  { country: 'Mexico', code: 'MX', priority: 4, enabled: true },
];

export const DEFAULT_MOVIE_COUNTRY_PRIORITIES: CountryPriorityConfig[] = [
  { country: 'United States', code: 'US', priority: 1, enabled: true },
];

// Daily Story Generation Settings
export interface DailyStorySettings {
  userId: string;
  isEnabled: boolean;
  publishTime: string; // HH:mm format (e.g., "09:00")
  timezone: string; // e.g., "Asia/Riyadh"
  platforms: Array<'facebook' | 'instagram' | 'tiktok'>;
  categories: Array<typeof storyCategories[number]>;
  videoQuality: 'sd' | 'hd' | '4k';
  publishInterval: number; // minutes between each story
  updatedAt: Date;
}

export const insertDailyStorySettingsSchema = z.object({
  isEnabled: z.boolean().default(true),
  publishTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm'),
  timezone: z.string().default('Asia/Riyadh'),
  platforms: z.array(z.enum(platforms)).min(1),
  categories: z.array(z.enum(storyCategories)).min(1),
  musicMood: z.enum(['energetic', 'calm', 'uplifting', 'dramatic']).default('energetic'),
  videoQuality: z.enum(['sd', 'hd', '4k']).default('hd'),
  videoDuration: z.number().int().min(10).max(60).default(20),
  publishInterval: z.number().int().min(5).max(30).default(5),
  autoRetry: z.boolean().default(true),
  maxRetries: z.number().int().min(1).max(5).default(3),
}).extend({
  publishInterval: z.number().int().min(1).max(60).default(5),
});

export type InsertDailyStorySettings = z.infer<typeof insertDailyStorySettingsSchema>;

// Video Generation Progress Tracking
export interface VideoGenerationProgress {
  storyId: string;
  status: 'pending' | 'downloading' | 'music_fetching' | 'generating' | 'uploading' | 'completed' | 'error';
  progress: number; // 0-100
  currentStep: string;
  error?: string;
  startedAt: Date;
  updatedAt: Date;
}
