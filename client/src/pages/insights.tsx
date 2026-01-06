import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { SmartInsights, BestTimeRecommendation, TrendingHashtag, ContentRecommendation } from "@shared/schema";

export default function Insights() {
  const { data: insights, isLoading } = useQuery<SmartInsights>({
    queryKey: ["/api/smart/insights"],
  });

  const { data: contentRecs } = useQuery<ContentRecommendation[]>({
    queryKey: ["/api/smart/content-recommendations"],
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">التوصيات الذكية</h1>
        <p className="text-muted-foreground mt-2">
          احصل على توصيات مخصصة بناءً على أداء محتواك
        </p>
      </div>

      {insights && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Best Posting Times */}
          <Card data-testid="card-best-times">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-clock text-primary"></i>
                أفضل أوقات النشر
              </CardTitle>
              <CardDescription>
                الأوقات التي حققت أعلى تفاعل
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.bestPostingTimes.length > 0 ? (
                <div className="space-y-3">
                  {insights.bestPostingTimes.slice(0, 5).map((time: BestTimeRecommendation, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                      data-testid={`time-recommendation-${idx}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <i className="fas fa-calendar-day text-sm"></i>
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-day-${idx}`}>{time.dayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {time.hour}:00 - {time.timeSlot}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-primary" data-testid={`text-engagement-${idx}`}>
                          {time.averageEngagement.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {time.postCount > 0 ? `${time.postCount} منشور` : 'توصية عامة'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد بيانات كافية لتحليل أوقات النشر
                </p>
              )}
            </CardContent>
          </Card>

          {/* Top Performing Categories */}
          <Card data-testid="card-top-categories">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-chart-line text-green-500"></i>
                الفئات الأكثر نجاحاً
              </CardTitle>
              <CardDescription>
                الفئات التي حققت أفضل أداء
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.topPerformingCategories.length > 0 ? (
                <div className="space-y-3">
                  {insights.topPerformingCategories.map((cat, idx) => {
                    const categoryData = getCategoryData(cat.category);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                        data-testid={`category-stat-${idx}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryData.color} text-white`}>
                            <i className={`fas ${categoryData.icon} text-sm`}></i>
                          </div>
                          <div>
                            <p className="font-medium">{categoryData.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {cat.postCount} منشور
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-500">
                            {cat.averageEngagement.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد بيانات كافية لتحليل الفئات
                </p>
              )}
            </CardContent>
          </Card>

          {/* Platform Performance */}
          <Card data-testid="card-platform-performance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-share-nodes text-blue-500"></i>
                أداء المنصات
              </CardTitle>
              <CardDescription>
                أفضل منصة لمحتواك
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.platformPerformance.length > 0 ? (
                <div className="space-y-3">
                  {insights.platformPerformance.map((platform, idx) => {
                    const platformData = getPlatformData(platform.platform);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                        data-testid={`platform-stat-${idx}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <i className={`${platformData.icon} ${platformData.color} text-xl`}></i>
                          </div>
                          <div>
                            <p className="font-medium">{platformData.name}</p>
                            {platform.bestTime && (
                              <p className="text-sm text-muted-foreground">
                                أفضل وقت: {platform.bestTime}
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-blue-500">
                            {platform.averageEngagement.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد بيانات كافية لتحليل المنصات
                </p>
              )}
            </CardContent>
          </Card>

          {/* Trending Hashtags */}
          <Card data-testid="card-trending-hashtags">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-hashtag text-purple-500"></i>
                الهاشتاجات الرائجة
              </CardTitle>
              <CardDescription>
                الهاشتاجات الأكثر فاعلية
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.trendingHashtags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {insights.trendingHashtags.map((tag: TrendingHashtag, idx: number) => (
                    <Badge
                      key={idx}
                      variant={tag.trending ? "default" : "secondary"}
                      className="text-sm hover-elevate"
                      data-testid={`hashtag-${idx}`}
                    >
                      {tag.hashtag}
                      <span className="mr-1 text-xs opacity-75">
                        ({tag.averageEngagement.toFixed(1)}%)
                      </span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد هاشتاجات متاحة
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Suggestions */}
      {insights && insights.contentSuggestions.length > 0 && (
        <Card data-testid="card-content-suggestions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <i className="fas fa-lightbulb text-yellow-500"></i>
              نصائح لتحسين محتواك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.contentSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
                  data-testid={`suggestion-${idx}`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
                    <i className="fas fa-star text-sm"></i>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed">{suggestion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Recommendations */}
      {contentRecs && contentRecs.length > 0 && (
        <Card data-testid="card-content-recommendations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <i className="fas fa-magic text-pink-500"></i>
              اقتراحات محتوى مخصصة
            </CardTitle>
            <CardDescription>
              بناءً على أدائك السابق
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {contentRecs.map((rec, idx) => {
                const categoryData = getCategoryData(rec.category);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-border hover-elevate"
                    data-testid={`content-rec-${idx}`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryData.color} text-white`}>
                        <i className={`fas ${categoryData.icon} text-sm`}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{categoryData.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {rec.suggestedContent}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <i className="fas fa-chart-line text-green-500"></i>
                        متوقع: {rec.expectedEngagement.toFixed(1)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fas fa-share-nodes text-blue-500"></i>
                        {rec.suggestedPlatforms.join(", ")}
                      </span>
                    </div>

                    {rec.suggestedHashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {rec.suggestedHashtags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      <i className="fas fa-info-circle ml-1"></i>
                      {rec.reasoning}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getCategoryData(category: string) {
  const categories: Record<string, { name: string; icon: string; color: string }> = {
    movies: { name: "أفلام", icon: "fa-film", color: "bg-blue-500" },
    tv_shows: { name: "مسلسلات", icon: "fa-tv", color: "bg-purple-500" },
    sports: { name: "رياضة", icon: "fa-futbol", color: "bg-green-500" },
    recipes: { name: "وصفات", icon: "fa-utensils", color: "bg-orange-500" },
    gaming: { name: "ألعاب", icon: "fa-gamepad", color: "bg-red-500" },
    apps: { name: "تطبيقات", icon: "fa-mobile-screen", color: "bg-cyan-500" },
  };
  return categories[category] || { name: category, icon: "fa-circle", color: "bg-gray-500" };
}

function getPlatformData(platform: string) {
  const platforms: Record<string, { name: string; icon: string; color: string }> = {
    facebook: { name: "Facebook", icon: "fab fa-facebook", color: "text-facebook" },
    instagram: { name: "Instagram", icon: "fab fa-instagram", color: "text-instagram" },
    tiktok: { name: "TikTok", icon: "fab fa-tiktok", color: "text-tiktok" },
  };
  return platforms[platform] || { name: platform, icon: "fa-circle", color: "text-gray-500" };
}
