import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, Sparkles, Target, 
  Calendar, BarChart3, Brain, Zap, Clock, Eye, Heart, Share2, MessageSquare,
  ArrowRight, CheckCircle2, AlertCircle, Activity, PieChart
} from "lucide-react";
import type { Story, PlatformAnalytics } from "@shared/schema";
import { Link } from "wouter";

interface SmartRecommendation {
  id: string;
  type: 'optimization' | 'warning' | 'suggestion' | 'insight' | 'urgent';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: string;
  impact?: string;
  metric?: string;
}

interface DashboardInsights {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  keyMetrics: {
    engagement: { value: number; trend: number; label: string };
    reach: { value: number; trend: number; label: string };
    consistency: { value: number; trend: number; label: string };
    growth: { value: number; trend: number; label: string };
  };
  recommendations: SmartRecommendation[];
  predictions: {
    nextWeekEngagement: number;
    bestPerformingDay: string;
    suggestedPostCount: number;
  };
}

interface PerformanceAnalysis {
  contentQuality: { score: number; feedback: string };
  timingOptimization: { score: number; feedback: string };
  audienceEngagement: { score: number; feedback: string };
  growthPotential: { score: number; feedback: string };
}

interface TrendAnalysis {
  trendingTopics: Array<{ topic: string; growth: number; relevance: number }>;
  competitorInsights: Array<{ platform: string; avgEngagement: number; yourEngagement: number }>;
  contentGaps: Array<{ category: string; opportunity: string; priority: 'high' | 'medium' | 'low' }>;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalStories: number;
    scheduled: number;
    published: number;
    avgEngagement: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: recentStories, isLoading: storiesLoading } = useQuery<Story[]>({
    queryKey: ["/api/stories/recent"],
  });

  const { data: platformStats, isLoading: platformLoading } = useQuery<PlatformAnalytics[]>({
    queryKey: ["/api/stats/platforms"],
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<DashboardInsights>({
    queryKey: ["/api/smart-algorithms/dashboard-insights"],
  });

  const { data: performanceAnalysis, isLoading: performanceLoading } = useQuery<PerformanceAnalysis>({
    queryKey: ["/api/smart-algorithms/performance-analysis"],
  });

  const { data: trendAnalysis, isLoading: trendsLoading } = useQuery<TrendAnalysis>({
    queryKey: ["/api/smart-algorithms/trend-analysis"],
  });

  const { data: engagementStats, isLoading: engagementLoading } = useQuery<{
    likes: number;
    likesChange: number;
    shares: number;
    sharesChange: number;
    comments: number;
    commentsChange: number;
    views: number;
    viewsChange: number;
  }>({
    queryKey: ["/api/stats/engagement"],
  });

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-500';
    if (trend < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'urgent': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'optimization': return <Target className="w-4 h-4 text-blue-500" />;
      case 'suggestion': return <Lightbulb className="w-4 h-4 text-purple-500" />;
      default: return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">عالية</Badge>;
      case 'medium': return <Badge variant="secondary">متوسطة</Badge>;
      default: return <Badge variant="outline">منخفضة</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const statCards = [
    {
      title: "إجمالي القصص",
      value: stats?.totalStories || 0,
      icon: "fa-layer-group",
      description: "جميع القصص المنشأة",
      color: "text-primary",
    },
    {
      title: "القصص المجدولة",
      value: stats?.scheduled || 0,
      icon: "fa-clock",
      description: "في انتظار النشر",
      color: "text-blue-500",
    },
    {
      title: "القصص المنشورة",
      value: stats?.published || 0,
      icon: "fa-circle-check",
      description: "تم نشرها بنجاح",
      color: "text-green-500",
    },
    {
      title: "معدل التفاعل",
      value: `${(stats?.avgEngagement || 0).toFixed(1)}%`,
      icon: "fa-heart",
      description: "متوسط التفاعل",
      color: "text-pink-500",
    },
  ];

  const platformIcons: Record<string, { icon: string; color: string }> = {
    facebook: { icon: "fab fa-facebook", color: "text-facebook" },
    instagram: { icon: "fab fa-instagram", color: "text-instagram" },
    tiktok: { icon: "fab fa-tiktok", color: "text-tiktok" },
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-2">نظرة عامة ذكية على أداء قصصك</p>
        </div>
        <div className="flex gap-2">
          <Link href="/schedule">
            <Button data-testid="button-new-story">
              <Calendar className="w-4 h-4 ml-2" />
              قصة جديدة
            </Button>
          </Link>
        </div>
      </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => (
              <Card key={`stat-card-${index}-${stat.title}`} className="hover-elevate" data-testid={`card-stat-${stat.title}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${stat.color}`}>
                <i className={`fas ${stat.icon}`}></i>
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid={`stat-${stat.title}`}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="w-4 h-4 ml-2" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <Brain className="w-4 h-4 ml-2" />
            تحليل ذكي
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="w-4 h-4 ml-2" />
            الترندات
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Lightbulb className="w-4 h-4 ml-2" />
            التوصيات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {insightsLoading ? (
                        <>
                          <Card key="skeleton-score-card-overview" className="md:col-span-2">
                            <CardHeader>
                              <Skeleton className="h-6 w-32" />
                            </CardHeader>
                            <CardContent>
                              <Skeleton className="h-24 w-full" />
                            </CardContent>
                          </Card>
                          <Card key="skeleton-predictions-card-overview">
                            <CardContent className="pt-6">
                              <Skeleton className="h-20 w-full" />
                            </CardContent>
                          </Card>
                          <Card key="skeleton-recommendations-card-overview">
                            <CardContent className="pt-6">
                              <Skeleton className="h-20 w-full" />
                            </CardContent>
                          </Card>
                        </>
                      ) : insights ? (
                        <>
                          <Card key="overall-score-card-actual" className="md:col-span-2 hover-elevate" data-testid="card-overall-score">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">النتيجة الإجمالية للأداء</CardTitle>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(insights.trend)}
                      <span className={`text-sm font-medium ${getTrendColor(insights.trendPercent)}`}>
                        {insights.trendPercent > 0 ? '+' : ''}{insights.trendPercent}%
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-4xl font-bold" data-testid="text-overall-score">
                        {insights.overallScore}
                      </div>
                      <div className="flex-1">
                        <Progress value={insights.overallScore} className="h-3" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      {Object.entries(insights.keyMetrics).map(([key, metric], idx) => (
                        <div key={`overview-metric-${key}-${idx}`} className="space-y-1">
                          <p className="text-xs text-muted-foreground">{metric.label}</p>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">{metric.value}%</span>
                            <span className={`text-xs ${getTrendColor(metric.trend)}`}>
                              {metric.trend > 0 ? '+' : ''}{metric.trend}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card key="predictions-card-actual" className="hover-elevate" data-testid="card-predictions">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">التوقعات</CardTitle>
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">تفاعل الأسبوع القادم</p>
                      <p className="text-lg font-bold" data-testid="text-next-week-engagement">
                        {insights.predictions.nextWeekEngagement}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">أفضل يوم للنشر</p>
                      <p className="text-sm font-medium" data-testid="text-best-day">
                        {insights.predictions.bestPerformingDay}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">عدد المنشورات المقترح</p>
                      <p className="text-sm font-medium" data-testid="text-suggested-posts">
                        {insights.predictions.suggestedPostCount} منشور/أسبوع
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card key="quick-recommendations-card-actual" className="hover-elevate" data-testid="card-quick-recommendations">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">توصيات سريعة</CardTitle>
                    <Lightbulb className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {insights.recommendations.slice(0, 2).map((rec, index) => (
                      <div key={`rec-${rec.id}-${index}`} className="flex items-start gap-2 mb-2 last:mb-0">
                        {getRecommendationIcon(rec.type)}
                        <p className="text-xs text-muted-foreground line-clamp-2">{rec.title}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>النشاط الأخير</CardTitle>
                <CardDescription>آخر 5 قصص تم إنشاؤها</CardDescription>
              </CardHeader>
              <CardContent>
                {storiesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={`skeleton-recent-story-${i}`} className="h-16 w-full" />
                    ))}
                  </div>
                ) : recentStories && recentStories.length > 0 ? (
                  <div className="space-y-3">
                    {recentStories.map((story, index) => (
                      <div
                        key={`recent-story-${story.id}-${index}`}
                        className="flex items-center gap-3 p-3 rounded-md border hover-elevate"
                        data-testid={`story-${story.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{story.content.substring(0, 50)}...</p>
                          <div className="flex items-center gap-2 mt-1">
                            {(story.status === 'published' && story.publishedPlatforms ? story.publishedPlatforms : story.platforms).map((platform, idx) => (
                              <i
                                key={`${story.id}-platform-${idx}`}
                                className={`${platformIcons[platform]?.icon} ${platformIcons[platform]?.color} text-sm`}
                              ></i>
                            ))}
                            <span className="text-xs text-muted-foreground">
                              {new Date(story.scheduledTime).toLocaleDateString("ar-EG")}
                            </span>
                          </div>
                        </div>
                        <div className="flex h-8 items-center justify-center rounded-md px-3 bg-muted text-xs font-medium">
                          {story.status === "scheduled" ? "مجدولة" : story.status === "published" ? "منشورة" : "مسودة"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-inbox text-4xl text-muted-foreground mb-3"></i>
                    <p className="text-muted-foreground">لا توجد قصص بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>توزيع المنصات</CardTitle>
                <CardDescription>إحصائيات النشر على كل منصة</CardDescription>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={`skeleton-platform-dist-${i}`} className="h-12 w-full" />
                    ))}
                  </div>
                ) : platformStats && platformStats.length > 0 ? (
                  <div className="space-y-4">
                    {platformStats.map((platform, index) => (
                      <div key={`platform-${platform.platform}-${index}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <i
                              className={`${platformIcons[platform.platform]?.icon} ${platformIcons[platform.platform]?.color} text-lg`}
                            ></i>
                            <span className="font-medium capitalize">{platform.platform}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {platform.publishedStories} من {platform.totalStories}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{
                              width: `${platform.totalStories > 0 ? (platform.publishedStories / platform.totalStories) * 100 : 0}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-chart-pie text-4xl text-muted-foreground mb-3"></i>
                    <p className="text-muted-foreground">لا توجد بيانات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-performance-analysis">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  تحليل الأداء الذكي
                </CardTitle>
                <CardDescription>تقييم شامل لجودة المحتوى والأداء</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {performanceLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={`skeleton-perf-analysis-${i}`} className="h-16 w-full" />)}
                  </div>
                ) : performanceAnalysis ? (
                  Object.entries(performanceAnalysis).map(([key, data]) => (
                    <div key={`perf-${key}`} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {key === 'contentQuality' && 'جودة المحتوى'}
                          {key === 'timingOptimization' && 'تحسين التوقيت'}
                          {key === 'audienceEngagement' && 'تفاعل الجمهور'}
                          {key === 'growthPotential' && 'إمكانية النمو'}
                        </span>
                        <span className={`font-bold ${getScoreColor(data.score as number)}`}>
                          {data.score}%
                        </span>
                      </div>
                      <Progress value={data.score as number} className="h-2" />
                      <p className="text-xs text-muted-foreground">{data.feedback}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">لا توجد بيانات</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-engagement-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  مقاييس التفاعل
                </CardTitle>
                <CardDescription>تحليل تفاعل الجمهور مع المحتوى</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {engagementLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={`skeleton-engagement-metric-${i}`} className="h-24 w-full" />)}
                  </div>
                ) : engagementStats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted space-y-1">
                      <div className="flex items-center gap-2 text-pink-500">
                        <Heart className="w-4 h-4" />
                        <span className="text-xs">الإعجابات</span>
                      </div>
                      <p className="text-2xl font-bold">{engagementStats.likes >= 1000 ? `${(engagementStats.likes / 1000).toFixed(1)}K` : engagementStats.likes}</p>
                      <p className={`text-xs ${engagementStats.likesChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {engagementStats.likesChange >= 0 ? '+' : ''}{engagementStats.likesChange}% من الأسبوع الماضي
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted space-y-1">
                      <div className="flex items-center gap-2 text-blue-500">
                        <Share2 className="w-4 h-4" />
                        <span className="text-xs">المشاركات</span>
                      </div>
                      <p className="text-2xl font-bold">{engagementStats.shares >= 1000 ? `${(engagementStats.shares / 1000).toFixed(1)}K` : engagementStats.shares}</p>
                      <p className={`text-xs ${engagementStats.sharesChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {engagementStats.sharesChange >= 0 ? '+' : ''}{engagementStats.sharesChange}% من الأسبوع الماضي
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted space-y-1">
                      <div className="flex items-center gap-2 text-purple-500">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs">التعليقات</span>
                      </div>
                      <p className="text-2xl font-bold">{engagementStats.comments >= 1000 ? `${(engagementStats.comments / 1000).toFixed(1)}K` : engagementStats.comments}</p>
                      <p className={`text-xs ${engagementStats.commentsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {engagementStats.commentsChange >= 0 ? '+' : ''}{engagementStats.commentsChange}% من الأسبوع الماضي
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted space-y-1">
                      <div className="flex items-center gap-2 text-green-500">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">المشاهدات</span>
                      </div>
                      <p className="text-2xl font-bold">{engagementStats.views >= 1000 ? `${(engagementStats.views / 1000).toFixed(1)}K` : engagementStats.views}</p>
                      <p className={`text-xs ${engagementStats.viewsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {engagementStats.viewsChange >= 0 ? '+' : ''}{engagementStats.viewsChange}% من الأسبوع الماضي
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">لا توجد بيانات تفاعل</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-competitor-analysis">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                مقارنة الأداء
              </CardTitle>
              <CardDescription>أداءك مقارنة بمتوسط السوق</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={`skeleton-trend-comp-${i}`} className="h-12 w-full" />)}
                </div>
              ) : trendAnalysis?.competitorInsights ? (
                <div className="space-y-4">
                  {trendAnalysis.competitorInsights.map((insight, index) => (
                    <div key={`comp-insight-${insight.platform}-${index}`} className="flex items-center gap-4">
                      <i className={`${platformIcons[insight.platform]?.icon} ${platformIcons[insight.platform]?.color} text-xl w-8`}></i>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium capitalize">{insight.platform}</span>
                          <span className="text-sm">
                            <span className="font-medium">{insight.yourEngagement}%</span>
                            <span className="text-muted-foreground"> / {insight.avgEngagement}% متوسط</span>
                          </span>
                        </div>
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="absolute h-full bg-muted-foreground/30 rounded-full"
                            style={{ width: `${(insight.avgEngagement / 10) * 100}%` }}
                          ></div>
                          <div 
                            className={`absolute h-full rounded-full ${insight.yourEngagement >= insight.avgEngagement ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${(insight.yourEngagement / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      {insight.yourEngagement >= insight.avgEngagement ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">لا توجد بيانات</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-trending-topics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  المواضيع الرائجة
                </CardTitle>
                <CardDescription>أكثر المواضيع انتشاراً حالياً</CardDescription>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={`skeleton-trending-${i}`} className="h-16 w-full" />)}
                  </div>
                ) : trendAnalysis?.trendingTopics?.length ? (
                  <div className="space-y-3">
                    {trendAnalysis.trendingTopics.map((topic, index) => (
                      <div 
                        key={`trend-${topic.topic}-${index}`}
                        className="flex items-center gap-3 p-3 rounded-md border hover-elevate"
                        data-testid={`trend-topic-${index}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{topic.topic}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-green-500">+{topic.growth}% نمو</span>
                            <span className="text-xs text-muted-foreground">|</span>
                            <span className="text-xs text-muted-foreground">{topic.relevance}% ملاءمة</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" data-testid={`button-use-trend-${index}`}>
                          استخدم
                          <ArrowRight className="w-4 h-4 mr-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">لا توجد مواضيع رائجة</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-content-gaps">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  فرص المحتوى
                </CardTitle>
                <CardDescription>فجوات المحتوى التي يمكنك استغلالها</CardDescription>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={`skeleton-gaps-${i}`} className="h-24 w-full" />)}
                  </div>
                ) : trendAnalysis?.contentGaps?.length ? (
                  <div className="space-y-3">
                    {trendAnalysis.contentGaps.map((gap, index) => (
                      <div 
                        key={`gap-${gap.category}-${index}`}
                        className="p-4 rounded-md border space-y-2 hover-elevate"
                        data-testid={`content-gap-${index}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{gap.category}</span>
                          {getPriorityBadge(gap.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground">{gap.opportunity}</p>
                        <Link href="/schedule">
                          <Button size="sm" className="w-full" data-testid={`button-create-content-${index}`}>
                            إنشاء محتوى
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">لا توجد فرص محتوى</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-best-posting-times">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                أفضل أوقات النشر
              </CardTitle>
              <CardDescription>الأوقات الموصى بها للنشر بناءً على تحليل الجمهور</CardDescription>
            </CardHeader>
            <CardContent>
              {insights?.predictions ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div 
                    className="p-4 rounded-lg bg-muted text-center space-y-2"
                    data-testid="time-slot-best-day"
                  >
                    <p className="text-lg font-bold">أفضل يوم</p>
                    <p className="text-2xl font-bold text-primary">{insights.predictions.bestPerformingDay}</p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-medium text-green-500">موصى به</span>
                    </div>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted text-center space-y-2"
                    data-testid="time-slot-suggested-posts"
                  >
                    <p className="text-lg font-bold">المنشورات المقترحة</p>
                    <p className="text-2xl font-bold text-primary">{insights.predictions.suggestedPostCount}</p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-muted-foreground">منشور/أسبوع</span>
                    </div>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted text-center space-y-2"
                    data-testid="time-slot-engagement"
                  >
                    <p className="text-lg font-bold">التفاعل المتوقع</p>
                    <p className="text-2xl font-bold text-primary">{insights.predictions.nextWeekEngagement}%</p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-muted-foreground">للأسبوع القادم</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">لا توجد بيانات متاحة</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {insights && insights.recommendations.length > 0 && (
            <Card data-testid="card-smart-recommendations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  التوصيات الذكية
                </CardTitle>
                <CardDescription>توصيات مخصصة لتحسين أداء منشوراتك</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.recommendations.map((rec, index) => (
                    <div
                      key={`rec-tab-item-${rec.id}-${index}`}
                      className="flex items-start gap-3 p-4 rounded-md border hover-elevate"
                      data-testid={`recommendation-${rec.id}`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                        {getRecommendationIcon(rec.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium">{rec.title}</p>
                          {getPriorityBadge(rec.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                        {rec.impact && (
                          <p className="text-xs text-green-500">التأثير المتوقع: {rec.impact}</p>
                        )}
                      </div>
                      {rec.actionable && (
                        <Button size="sm" variant="outline" data-testid={`button-action-${rec.id}`}>
                          {rec.action || 'تنفيذ'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-action-items">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                خطوات عملية
              </CardTitle>
              <CardDescription>إجراءات موصى بها بناءً على تحليل أدائك</CardDescription>
            </CardHeader>
            <CardContent>
              {insights?.recommendations && insights.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {insights.recommendations.slice(0, 4).map((rec, index) => (
                    <div 
                      key={`action-item-${rec.id}-${index}`}
                      className="flex items-center gap-3 p-3 rounded-md border"
                      data-testid={`action-item-${rec.id}`}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted-foreground">
                        <span className="text-xs font-medium">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-sm">{rec.title}</span>
                        {rec.impact && (
                          <p className="text-xs text-green-500 mt-1">{rec.impact}</p>
                        )}
                      </div>
                      {getPriorityBadge(rec.priority)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  لا توجد إجراءات موصى بها حالياً
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
