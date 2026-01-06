import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { InsertStory, YouTubeMusicSearchResult } from "@shared/schema";
import { Link } from "wouter";
import { MusicSearch } from "@/components/MusicSearch";
import { 
  Film, Star, Globe, Play, Flame, Quote, X, CheckCircle, Info, 
  CalendarPlus, Loader2, Sparkles, Clock, AlertTriangle, Image, Music,
  Tv, Trophy, UtensilsCrossed, Gamepad2, Smartphone, Zap
} from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";
import type { LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";

interface OptimalTimeSlot {
  dayOfWeek: number;
  hour: number;
  dayName: string;
  timeLabel: string;
  score: number;
  reason: string;
}

interface TrendingImageResult {
  pngUrl: string;
  webpUrl: string;
  facebookPngUrl: string;
  instagramPngUrl: string;
  tiktokWebpUrl: string;
  trendingTopic: string;
  posterTitle: string;
  latestEpisode?: number;
  sourceImageUrl: string;
  message: string;
  originCountry?: string;
  tmdbId?: number;
  descriptionAr?: string;
  descriptionEn?: string;
  voteAverage?: number;
}

export default function Schedule() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [facebookPngUrl, setFacebookPngUrl] = useState("");
  const [instagramPngUrl, setInstagramPngUrl] = useState("");
  const [tiktokWebpUrl, setTiktokWebpUrl] = useState("");
  const [trendingTopic, setTrendingTopic] = useState("");
  const [posterTitle, setPosterTitle] = useState("");
  const [latestEpisode, setLatestEpisode] = useState<number | undefined>();
  const [selectedMusic, setSelectedMusic] = useState<YouTubeMusicSearchResult | null>(null);
  const [originCountry, setOriginCountry] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [voteAverage, setVoteAverage] = useState<number | undefined>();
  const [hashtags, setHashtags] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const suggestHashtagsMutation = useMutation({
    mutationFn: async () => {
      const content = latestEpisode 
        ? `${posterTitle} - الحلقة ${latestEpisode} - ترند الآن`
        : `${posterTitle} - ترند الآن`;
      const response = await apiRequest("POST", "/api/ai/suggest-hashtags", { content, category });
      return await response.json();
    },
    onSuccess: (data: { hashtags: string[] }) => {
      setHashtags(data.hashtags);
      toast({
        title: "تم توليد الهاشتاجات",
        description: "تم تحديث قائمة الهاشتاجات المقترحة",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: apiConfigs, isLoading: apiConfigsLoading } = useQuery<Array<{provider: string; isConnected: boolean}>>({
    queryKey: ['/api/api-configs/status'],
  });

  const { data: optimalTimes, isLoading: optimalTimesLoading } = useQuery<OptimalTimeSlot[]>({
    queryKey: ['/api/smart-algorithms/optimal-times'],
  });

  const useOptimalTimeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/smart-algorithms/suggest-schedule", { category });
      return await response.json();
    },
    onSuccess: (data: { suggestedTime: string; dayName: string; timeLabel: string; reason: string }) => {
      setScheduledTime(data.suggestedTime);
      toast({
        title: "تم اختيار الوقت الأمثل",
        description: `${data.dayName} - ${data.timeLabel}: ${data.reason}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async ({ category }: { category: string }) => {
      const response = await apiRequest("POST", "/api/trending-image/generate", { category });
      return await response.json() as TrendingImageResult;
    },
    onSuccess: (data) => {
      setGeneratedImageUrl(data.pngUrl);
      setFacebookPngUrl(data.facebookPngUrl);
      setInstagramPngUrl(data.instagramPngUrl);
      setTiktokWebpUrl(data.tiktokWebpUrl);
      setTrendingTopic(data.trendingTopic);
      setPosterTitle(data.posterTitle);
      setLatestEpisode(data.latestEpisode);
      setOriginCountry(data.originCountry || "");
      setDescriptionAr(data.descriptionAr || "");
      setDescriptionEn(data.descriptionEn || "");
      setVoteAverage(data.voteAverage);
      
      const countryNames: Record<string, string> = {
        'TR': 'Turkish',
        'US': 'American',
        'IN': 'Indian',
        'KR': 'Korean',
      };
      const countryLabel = data.originCountry ? countryNames[data.originCountry] || data.originCountry : '';
      
      toast({
        title: "تم توليد صورة الترند بنجاح",
        description: `${data.posterTitle}${data.latestEpisode ? ` - EP ${data.latestEpisode}` : ''}${countryLabel ? ` (${countryLabel})` : ''}${data.voteAverage ? ` - ${data.voteAverage}/10` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "فشل في توليد الصورة",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createStoryMutation = useMutation({
    mutationFn: async (story: InsertStory) => {
      return await apiRequest("POST", "/api/stories", story);
    },
    onSuccess: () => {
      toast({
        title: "تم جدولة القصة بنجاح",
        description: "سيتم نشر قصتك في الوقت المحدد",
      });
      setCategory("");
      setScheduledTime("");
      setSelectedPlatforms([]);
      setGeneratedImageUrl("");
      setFacebookPngUrl("");
      setInstagramPngUrl("");
      setTiktokWebpUrl("");
      setTrendingTopic("");
      setPosterTitle("");
      setLatestEpisode(undefined);
      setSelectedMusic(null);
      setOriginCountry("");
      setDescriptionAr("");
      setDescriptionEn("");
      setVoteAverage(undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stories/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platforms"] });
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const togglePlatform = (platform: string) => {
    const config = apiConfigs?.find(c => c.provider === platform);
    if (!config?.isConnected) {
      toast({
        title: "تحذير",
        description: `يجب إعداد وربط API لمنصة ${platformData.find(p => p.id === platform)?.name} في لوحة الإدارة أولاً`,
        variant: "destructive",
      });
      return;
    }
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const isPlatformConnected = (platform: string) => {
    return apiConfigs?.find(c => c.provider === platform)?.isConnected || false;
  };

  const disconnectedPlatforms = apiConfigs?.filter(c => 
    ['facebook', 'instagram', 'tiktok'].includes(c.provider) && !c.isConnected
  );

  const handleGenerateImage = () => {
    if (!category) {
      toast({
        title: "خطأ",
        description: "يجب اختيار الفئة أولاً",
        variant: "destructive",
      });
      return;
    }

    const r2Config = apiConfigs?.find(c => c.provider === 'cloudflare_r2');

    if (!r2Config?.isConnected) {
      toast({
        title: "خطأ: إعداد Cloudflare R2 مفقود",
        description: "يجب إعداد Cloudflare R2 Storage في لوحة الإدارة لحفظ الصور.",
        variant: "destructive",
      });
      return;
    }

    generateImageMutation.mutate({ category });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedPlatforms.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب اختيار منصة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "خطأ",
        description: "يجب اختيار الفئة",
        variant: "destructive",
      });
      return;
    }

    if (!generatedImageUrl) {
      toast({
        title: "خطأ",
        description: "يجب توليد صورة أولاً",
        variant: "destructive",
      });
      return;
    }

    const content = latestEpisode 
      ? `${posterTitle} - الحلقة ${latestEpisode} - ترند الآن ${hashtags.join(' ')}`
      : `${posterTitle} - ترند الآن ${hashtags.join(' ')}`;

    const story: InsertStory = {
      content,
      category: category as any,
      platforms: selectedPlatforms as any,
      scheduledTime: convertSaudiTimeToUTC(scheduledTime),
      format: "story",
      mediaUrl: generatedImageUrl,
      mediaType: 'image',
      trendingTopic,
      posterTitle,
      latestEpisode,
      facebookPngUrl,
      instagramPngUrl,
      tiktokWebpUrl,
      musicUrl: selectedMusic?.url,
      musicTitle: selectedMusic?.title,
      musicArtist: selectedMusic?.artist,
      musicThumbnail: selectedMusic?.thumbnail,
      musicDuration: selectedMusic?.duration,
      musicVideoId: selectedMusic?.videoId,
    };

    createStoryMutation.mutate(story);
  };

  const platformData: Array<{ id: string; name: string; Icon: IconType; color: string }> = [
    { id: "facebook", name: "فيسبوك", Icon: SiFacebook, color: "bg-facebook text-white" },
    { id: "instagram", name: "انستجرام", Icon: SiInstagram, color: "bg-instagram text-white" },
    { id: "tiktok", name: "تيك توك", Icon: SiTiktok, color: "bg-tiktok text-white" },
  ];

  const categoryData: Array<{ id: string; name: string; Icon: LucideIcon }> = [
    { id: "movies", name: "أفلام", Icon: Film },
    { id: "tv_shows", name: "مسلسلات", Icon: Tv },
    { id: "sports", name: "رياضة", Icon: Trophy },
    { id: "recipes", name: "وصفات", Icon: UtensilsCrossed },
    { id: "gaming", name: "ألعاب", Icon: Gamepad2 },
    { id: "apps", name: "تطبيقات", Icon: Smartphone },
  ];

  // Convert UTC time to Saudi Arabia time for display
  const convertUTCToSaudiTime = (utcDate: Date): string => {
    // Add 3 hours to UTC to get Saudi time
    const saudiTime = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
    return saudiTime.toISOString().slice(0, 16);
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    // Convert UTC to Saudi time for display in the input field
    return convertUTCToSaudiTime(now);
  };

  // Convert Saudi Arabia time (user's local time) to UTC
  const convertSaudiTimeToUTC = (saudiTimeString: string): string => {
    if (!saudiTimeString) return '';
    // saudiTimeString is in format "YYYY-MM-DDTHH:mm" (Saudi local time)
    const [datePart, timePart] = saudiTimeString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const saudiDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    const utcTime = new Date(saudiDate.getTime() - 3 * 60 * 60 * 1000);
    return utcTime.toISOString();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">جدولة القصص</h1>
        <p className="text-muted-foreground mt-2">قم بجدولة قصة جديدة باستخدام صور الترند الحالية</p>
      </div>

      {disconnectedPlatforms && disconnectedPlatforms.length > 0 && (
        <Alert variant="destructive" data-testid="alert-disconnected-platforms">
          <i className="fas fa-exclamation-triangle ml-2"></i>
          <AlertTitle>تحذير: بعض المنصات غير متصلة</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              يجب إعداد وربط مفاتيح API للمنصات التالية قبل أن تتمكن من جدولة القصص عليها:
              {' '}
              {disconnectedPlatforms.map(c => {
                const p = platformData.find(pd => pd.id === c.provider);
                return p?.name;
              }).filter(Boolean).join('، ')}
            </span>
            <Link href="/admin" className="text-sm underline hover:no-underline">
              انتقل إلى لوحة الإدارة لإعداد API
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل القصة</CardTitle>
              <CardDescription>املأ البيانات لجدولة القصة باستخدام صور الترند</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>اختر المنصات</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {platformData.map((platform) => {
                      const isConnected = isPlatformConnected(platform.id);
                      const isTikTok = platform.id === 'tiktok';
                      return (
                        <div key={platform.id} className="relative">
                          <button
                            type="button"
                            onClick={() => togglePlatform(platform.id)}
                            disabled={!isConnected || apiConfigsLoading}
                            className={`w-full flex flex-col items-center gap-2 p-4 rounded-md border-2 transition-all hover-elevate ${
                              selectedPlatforms.includes(platform.id)
                                ? `${platform.color} border-transparent`
                                : isConnected
                                ? "border-border hover:border-primary"
                                : "border-border opacity-50 cursor-not-allowed"
                            }`}
                            data-testid={`button-platform-${platform.id}`}
                          >
                            <platform.Icon className="text-2xl" />
                            <span className="text-sm font-medium">
                              {platform.name}
                              {!isConnected && ' (غير متصل)'}
                            </span>
                            {isConnected && isTikTok && (
                              <span className="text-xs opacity-80">
                                (WebP)
                              </span>
                            )}
                            {isConnected && !isTikTok && (
                              <span className="text-xs opacity-80">
                                (PNG)
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {selectedPlatforms.includes('tiktok') && (
                    <Alert className="bg-blue-500/10 border-blue-500/20">
                      <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 ml-2"></i>
                      <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm">
                        <strong>ملاحظة:</strong> TikTok سيستخدم صيغة WebP للصور بجودة عالية.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">الفئة</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryData.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <cat.Icon className="w-4 h-4" />
                            <span>{cat.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">وقت النشر</Label>
                  <div className="space-y-2">
                    <Input
                      id="scheduledTime"
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      min={getMinDateTime()}
                      required
                      data-testid="input-scheduledTime"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <i className="fas fa-info-circle"></i>
                      التوقيت المستخدم: توقيت السعودية (UTC+3)
                    </p>
                  </div>
                </div>

                <Card className="border-dashed bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      اقتراحات التوقيت الذكي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {optimalTimesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : optimalTimes && optimalTimes.length > 0 ? (
                      <div className="grid gap-2">
                        {optimalTimes.slice(0, 3).map((slot) => (
                          <button
                            key={`${slot.dayOfWeek}-${slot.hour}`}
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const targetDate = new Date();
                              const daysUntil = (slot.dayOfWeek - now.getDay() + 7) % 7 || 7;
                              targetDate.setDate(now.getDate() + daysUntil);
                              targetDate.setHours(slot.hour, 0, 0, 0);
                              // Convert UTC to Saudi time for display in the input field
                              setScheduledTime(convertUTCToSaudiTime(targetDate));
                              toast({
                                title: "تم اختيار الوقت",
                                description: `${slot.dayName} - ${slot.timeLabel}`,
                              });
                            }}
                            className="flex items-center justify-between gap-3 p-3 rounded-md border hover-elevate text-right"
                            data-testid={`button-optimal-time-${slot.dayOfWeek}-${slot.hour}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {slot.score}%
                              </div>
                              <div>
                                <p className="font-medium text-sm">{slot.dayName} - {slot.timeLabel}</p>
                                <p className="text-xs text-muted-foreground">{slot.reason}</p>
                              </div>
                            </div>
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">لا توجد اقتراحات متاحة حالياً</p>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => useOptimalTimeMutation.mutate()}
                      disabled={useOptimalTimeMutation.isPending || !category}
                      className="w-full"
                      data-testid="button-suggest-optimal-time"
                    >
                      {useOptimalTimeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 ml-2" />
                      )}
                      اقترح أفضل وقت تلقائياً
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>توليد محتوى تلقائياً من الترند الحالي</Label>
                    <Button
                      type="button"
                      onClick={handleGenerateImage}
                      disabled={!category || generateImageMutation.isPending}
                      className="w-full"
                      variant="default"
                      data-testid="button-generate-image"
                    >
                      {generateImageMutation.isPending ? (
                        <>
                          <i className="fas fa-spinner fa-spin ml-2"></i>
                          جاري توليد الصورة...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-image ml-2"></i>
                          توليد صورة
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      <i className="fas fa-info-circle ml-1"></i>
                      سيتم توليد صورة من الترند الحالي
                    </p>
                  </div>

                  {generatedImageUrl && (
                    <div className="space-y-3">
                      <Label>الصورة المولدة من الترند</Label>
                      <div className="space-y-2">
                        <div className="relative rounded-md overflow-hidden border-2 border-green-500">
                          <img 
                            src={generatedImageUrl} 
                            alt={posterTitle}
                            className="w-full h-auto max-h-96 object-contain"
                            data-testid="img-generated"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setGeneratedImageUrl("");
                              setFacebookPngUrl("");
                              setInstagramPngUrl("");
                              setTiktokWebpUrl("");
                              setTrendingTopic("");
                              setPosterTitle("");
                              setLatestEpisode(undefined);
                              setOriginCountry("");
                              setDescriptionAr("");
                              setDescriptionEn("");
                              setVoteAverage(undefined);
                            }}
                            className="absolute top-2 left-2"
                            data-testid="button-remove-generated-image"
                          >
                            <X className="w-4 h-4 ml-2" />
                            حذف
                          </Button>
                        </div>
                        <div className="p-3 bg-muted rounded-md space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-bold flex items-center gap-1">
                              <Film className="w-4 h-4 text-blue-500" />
                              {posterTitle}
                            </p>
                            {voteAverage && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                {voteAverage}/10
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {originCountry && (
                              <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {originCountry === 'US' ? 'American' : originCountry === 'TR' ? 'Turkish' : originCountry === 'KR' ? 'Korean' : originCountry === 'IN' ? 'Indian' : originCountry}
                              </span>
                            )}
                            {latestEpisode && (
                              <span className="text-xs bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                <Play className="w-3 h-3" />
                                EP {latestEpisode}
                              </span>
                            )}
                            <span className="text-xs bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              Trending
                            </span>
                          </div>
                          
                          {(descriptionAr || descriptionEn) && (
                            <div className="space-y-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                <Quote className="w-3 h-3" />
                                الوصف التشويقي
                              </p>
                              {descriptionAr && (
                                <p className="text-sm text-foreground/90 leading-relaxed" dir="rtl" data-testid="text-description-ar">
                                  {descriptionAr.length > 150 ? descriptionAr.substring(0, 150) + '...' : descriptionAr}
                                </p>
                              )}
                              {descriptionEn && descriptionEn !== descriptionAr && (
                                <p className="text-xs text-muted-foreground italic" data-testid="text-description-en">
                                  {descriptionEn.length > 100 ? descriptionEn.substring(0, 100) + '...' : descriptionEn}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-muted/50 rounded-md space-y-2">
                          <Label className="text-xs text-muted-foreground">روابط الصور حسب المنصة</Label>
                          <div className="grid gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <SiFacebook className="w-4 h-4 text-blue-600" />
                              <span className="text-muted-foreground">Facebook:</span>
                              <span className="font-mono truncate flex-1">{facebookPngUrl ? 'PNG جاهز' : '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <SiInstagram className="w-4 h-4 text-pink-600" />
                              <span className="text-muted-foreground">Instagram:</span>
                              <span className="font-mono truncate flex-1">{instagramPngUrl ? 'PNG جاهز' : '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <SiTiktok className="w-4 h-4" />
                              <span className="text-muted-foreground">TikTok:</span>
                              <span className="font-mono truncate flex-1">{tiktokWebpUrl ? 'WebP جاهز' : '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Alert className="bg-green-500/10 border-green-500/20">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                        <AlertDescription className="text-green-600 dark:text-green-400">
                          <strong>تم توليد الصورة بنجاح!</strong> الآن اختر المنصات والوقت واضغط على "جدولة القصة".
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {generatedImageUrl && (
                    <Alert className="bg-blue-500/10 border-blue-500/20">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                      <AlertDescription className="text-blue-600 dark:text-blue-400">
                        <strong>خطوة أخيرة:</strong> تأكد من اختيار المنصات والوقت، ثم اضغط على الزر أدناه لجدولة القصة.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createStoryMutation.isPending || generateImageMutation.isPending || !generatedImageUrl}
                    data-testid="button-submit"
                  >
                    {createStoryMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <CalendarPlus className="w-4 h-4 ml-2" />
                        حفظ وجدولة القصة للنشر
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <MusicSearch 
            onSelectMusic={(music) => setSelectedMusic(music)}
            selectedMusic={selectedMusic}
          />

          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>معاينة القصة</CardTitle>
              <CardDescription>كيف ستظهر قصتك على المنصات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-xs">
                <div className="relative rounded-3xl border-8 border-foreground/20 bg-background overflow-hidden shadow-xl">
                  <div className="aspect-[9/16] bg-gradient-to-br from-primary/20 via-background to-accent/20 flex flex-col">
                    {generatedImageUrl ? (
                      <div className="flex-1 relative">
                        <img
                          src={generatedImageUrl}
                          alt={posterTitle}
                          className="w-full h-full object-cover"
                          data-testid="img-preview"
                        />
                        <div className="absolute top-2 left-2 bg-green-500/90 text-white px-2 py-1 rounded-md text-xs font-medium">
                          <i className="fas fa-check-circle ml-1"></i>
                          ترند
                        </div>
                        {latestEpisode && (
                          <div className="absolute top-2 right-2 bg-red-500/90 text-white px-3 py-1 rounded-full text-sm font-bold">
                            الحلقة {latestEpisode}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          <p className="text-white text-sm font-medium">{posterTitle}</p>
                          <p className="text-white/70 text-xs">{trendingTopic}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center">
                          <i className="fas fa-image text-4xl text-muted-foreground/40 mb-2 block"></i>
                          <p className="text-sm text-muted-foreground">اضغط على زر توليد الصورة لرؤية المعاينة</p>
                        </div>
                      </div>
                    )}
                    {selectedMusic && (
                      <div className="p-3 bg-background/80 backdrop-blur-sm border-t border-border">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-music text-xs text-primary"></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{selectedMusic.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{selectedMusic.artist}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {generatedImageUrl && (
                      <div className="max-h-20 overflow-y-auto bg-background/90 border-t border-border p-2 space-y-1">
                        {descriptionAr && (
                          <p className="text-xs text-foreground/80 font-semibold leading-tight" dir="rtl">
                            {descriptionAr.substring(0, 80)}
                          </p>
                        )}
                        {descriptionEn && descriptionEn !== descriptionAr && (
                          <p className="text-xs text-muted-foreground italic leading-tight">
                            {descriptionEn.substring(0, 80)}
                          </p>
                        )}
                        <div className="flex justify-around text-xs pt-1 border-t border-border/50">
                          {selectedPlatforms.includes('facebook') && (
                            <div className="flex items-center gap-1 text-blue-500">
                              <i className="fab fa-facebook"></i>
                              <span>PNG</span>
                            </div>
                          )}
                          {selectedPlatforms.includes('instagram') && (
                            <div className="flex items-center gap-1 text-pink-500">
                              <i className="fab fa-instagram"></i>
                              <span>PNG</span>
                            </div>
                          )}
                          {selectedPlatforms.includes('tiktok') && (
                            <div className="flex items-center gap-1">
                              <i className="fab fa-tiktok"></i>
                              <span>WebP</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
