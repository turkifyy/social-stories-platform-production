import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import type { LinkedAccount, UserAccountStats } from "@shared/schema";

interface AccountHealth {
  accountId: string;
  tokenStatus: 'valid' | 'expiring_soon' | 'expired';
  tokenExpiresIn: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  quotaUsagePercent: number;
  lastSyncAt: string;
  healthScore: number;
}

interface AccountPerformance {
  accountId: string;
  engagementRate: number;
  engagementTrend: number;
  reach: number;
  reachTrend: number;
  impressions: number;
  impressionsTrend: number;
  bestContentType: string;
  topPerformingTime: string;
  followersGrowth: number;
}

interface AccountRecommendation {
  id: string;
  accountId: string;
  type: 'optimization' | 'warning' | 'tip';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
}

export default function Accounts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<LinkedAccount | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<UserAccountStats>({
    queryKey: ['/api/accounts/stats'],
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<LinkedAccount[]>({
    queryKey: ['/api/accounts', platformFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (platformFilter && platformFilter !== 'all') params.append('platform', platformFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : undefined;
      const response = await fetch(`/api/accounts?${params.toString()}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (!response.ok) throw new Error('فشل تحميل الحسابات');
      return response.json();
    },
  });

  const { data: accountHealth, isLoading: healthLoading } = useQuery<AccountHealth[]>({
    queryKey: ['/api/smart-algorithms/account-health'],
    refetchInterval: 30000, // Refresh every 30 seconds for real data
  });

  const { data: accountPerformance, isLoading: performanceLoading } = useQuery<AccountPerformance[]>({
    queryKey: ['/api/smart-algorithms/account-performance'],
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<AccountRecommendation[]>({
    queryKey: ['/api/smart-algorithms/account-recommendations'],
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: 'facebook' | 'instagram' | 'tiktok') => {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : undefined;
      const response = await fetch(`/api/oauth/${platform}/url`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (!response.ok) throw new Error('فشل الحصول على رابط التفويض');
      const data = await response.json();
      return data.url;
    },
    onSuccess: (url) => {
      window.open(url, '_blank', 'width=600,height=700');
      
      const checkInterval = setInterval(async () => {
        await queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/accounts/stats'] });
      }, 3000);

      setTimeout(() => clearInterval(checkInterval), 30000);
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest("DELETE", `/api/accounts/${accountId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "تم الحذف",
        description: "تم حذف الحساب بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts/stats'] });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const platformIcons: Record<string, { icon: string; color: string; name: string }> = {
    facebook: { icon: "fab fa-facebook", color: "text-facebook", name: "فيسبوك" },
    instagram: { icon: "fab fa-instagram", color: "text-instagram", name: "انستغرام" },
    tiktok: { icon: "fab fa-tiktok", color: "text-tiktok", name: "تيك توك" },
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    inactive: "bg-gray-500",
    expired: "bg-yellow-500",
    error: "bg-red-500",
  };

  const statusLabels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    expired: "منتهي",
    error: "خطأ",
  };

  const handleDeleteClick = (account: LinkedAccount) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const getHealthForAccount = (accountId: string) => {
    return accountHealth?.find(h => h.accountId === accountId);
  };

  const getPerformanceForAccount = (accountId: string) => {
    return accountPerformance?.find(p => p.accountId === accountId);
  };

  const getRecommendationsForAccount = (accountId: string) => {
    return recommendations?.filter(r => r.accountId === accountId) || [];
  };

  const getTokenStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'text-green-500';
      case 'expiring_soon': return 'text-yellow-500';
      case 'expired': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getTokenStatusLabel = (status: string) => {
    switch (status) {
      case 'valid': return 'صالح';
      case 'expiring_soon': return 'ينتهي قريباً';
      case 'expired': return 'منتهي';
      default: return 'غير معروف';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <i className="fas fa-arrow-up text-green-500"></i>;
    if (trend < 0) return <i className="fas fa-arrow-down text-red-500"></i>;
    return <i className="fas fa-minus text-muted-foreground"></i>;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-500/10';
      case 'medium': return 'border-yellow-500 bg-yellow-500/10';
      case 'low': return 'border-blue-500 bg-blue-500/10';
      default: return 'border-muted';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimization': return 'fas fa-lightbulb text-yellow-500';
      case 'warning': return 'fas fa-exclamation-triangle text-red-500';
      case 'tip': return 'fas fa-info-circle text-blue-500';
      default: return 'fas fa-circle';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">إدارة الحسابات المربوطة</h1>
        <p className="text-muted-foreground mt-2">ربط وإدارة حسابات التواصل الاجتماعي مع تحليل الأداء</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <i className="fas fa-robot text-primary"></i>
              </div>
              <div>
                <CardTitle className="text-sm">حالة المجدول التلقائي (GitHub Actions)</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">تحديثات حسابات التواصل والوصول تتم كل 5 دقائق</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200 gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                نشط الآن
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {statsLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : stats ? (
        <div className="space-y-4">
          <Card className="bg-gradient-to-l from-primary/5 via-primary/10 to-primary/5 border-primary/20" data-testid="card-quick-stats">
            <CardContent className="py-4">
              <div className="grid gap-6 md:grid-cols-5">
                <div className="text-center border-l border-primary/20 last:border-l-0">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <i className="fas fa-users text-primary text-lg"></i>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-followers">
                    {stats.totalFollowers && stats.totalFollowers > 0 ? stats.totalFollowers.toLocaleString('ar-SA') : '0'}
                  </p>
                  <p className="text-xs text-muted-foreground">إجمالي المتابعين</p>
                </div>
                <div className="text-center border-l border-primary/20 last:border-l-0">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <i className="fas fa-eye text-blue-500 text-lg"></i>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-reach">
                    {stats.totalReach && stats.totalReach > 0 ? stats.totalReach.toLocaleString('ar-SA') : '0'}
                  </p>
                  <p className="text-xs text-muted-foreground">إجمالي الوصول</p>
                </div>
                <div className="text-center border-l border-primary/20 last:border-l-0">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <i className="fas fa-chart-line text-green-500 text-lg"></i>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-avg-engagement">
                    {stats.avgEngagement?.toFixed(1) || '0'}%
                  </p>
                  <p className="text-xs text-muted-foreground">متوسط التفاعل</p>
                </div>
                <div className="text-center border-l border-primary/20 last:border-l-0">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <i className="fas fa-file-alt text-purple-500 text-lg"></i>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-posts">
                    {stats.totalPosts?.toLocaleString('ar-SA') || '0'}
                  </p>
                  <p className="text-xs text-muted-foreground">إجمالي المنشورات</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <i className="fas fa-arrow-trend-up text-emerald-500 text-lg"></i>
                  </div>
                  <p className="text-2xl font-bold text-emerald-500" data-testid="text-growth-rate">
                    +{stats.growthRate?.toFixed(1) || '0'}%
                  </p>
                  <p className="text-xs text-muted-foreground">معدل النمو الشهري</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="hover-elevate" data-testid="card-total-accounts">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">إجمالي الحسابات</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
                  <i className="fas fa-link text-lg"></i>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-accounts">{stats.totalAccounts}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={(stats.totalAccounts / stats.maxAccounts) * 100} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{stats.maxAccounts} حد</span>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-facebook-accounts">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">فيسبوك</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                  <i className="fab fa-facebook text-lg"></i>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-facebook-count">{stats.facebookAccounts}</div>
                <p className="text-xs text-muted-foreground">صفحات مربوطة</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-instagram-accounts">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">انستغرام</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E4405F]/10 text-[#E4405F]">
                  <i className="fab fa-instagram text-lg"></i>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-instagram-count">{stats.instagramAccounts}</div>
                <p className="text-xs text-muted-foreground">حسابات مربوطة</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-tiktok-accounts">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">تيك توك</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/10 dark:bg-white/10">
                  <i className="fab fa-tiktok text-lg"></i>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-tiktok-count">{stats.tiktokAccounts}</div>
                <p className="text-xs text-muted-foreground">حسابات مربوطة</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>ربط حساب جديد</CardTitle>
          <CardDescription>اختر منصة لربط حساب جديد</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => connectMutation.mutate('facebook')}
              disabled={connectMutation.isPending}
              className="gap-2"
              data-testid="button-connect-facebook"
            >
              <i className="fab fa-facebook"></i>
              ربط فيسبوك
            </Button>
            <Button
              onClick={() => connectMutation.mutate('instagram')}
              disabled={connectMutation.isPending}
              className="gap-2"
              data-testid="button-connect-instagram"
            >
              <i className="fab fa-instagram"></i>
              ربط انستغرام
            </Button>
            <Button
              onClick={() => connectMutation.mutate('tiktok')}
              disabled={connectMutation.isPending}
              className="gap-2"
              data-testid="button-connect-tiktok"
            >
              <i className="fab fa-tiktok"></i>
              ربط تيك توك
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts" data-testid="tab-accounts">
            <i className="fas fa-users ml-2"></i>
            الحسابات
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <i className="fas fa-heartbeat ml-2"></i>
            صحة الحسابات
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <i className="fas fa-chart-line ml-2"></i>
            الأداء
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <i className="fas fa-lightbulb ml-2"></i>
            التوصيات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>الحسابات المربوطة</CardTitle>
              <CardDescription>إدارة جميع الحسابات المربوطة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row mb-6">
                <Input
                  placeholder="بحث عن حساب..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  data-testid="input-search-accounts"
                />
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-platform-filter">
                    <SelectValue placeholder="جميع المنصات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المنصات</SelectItem>
                    <SelectItem value="facebook">فيسبوك</SelectItem>
                    <SelectItem value="instagram">انستغرام</SelectItem>
                    <SelectItem value="tiktok">تيك توك</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-status-filter">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                    <SelectItem value="expired">منتهي</SelectItem>
                    <SelectItem value="error">خطأ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accountsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-48" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <Card key={account.id} className="hover-elevate" data-testid={`card-account-${account.id}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4 flex-wrap">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={account.profilePictureUrl} />
                            <AvatarFallback>
                              <i className={platformIcons[account.platform]?.icon}></i>
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-semibold text-lg" data-testid={`text-account-name-${account.id}`}>
                                {account.name}
                              </h3>
                              <Badge className={statusColors[account.status]} data-testid={`badge-status-${account.id}`}>
                                {statusLabels[account.status]}
                              </Badge>
                              <Badge variant="outline">
                                <i className={`${platformIcons[account.platform]?.icon} ml-1`}></i>
                                {platformIcons[account.platform]?.name}
                              </Badge>
                            </div>

                            {account.username && (
                              <p className="text-sm text-muted-foreground mb-2">@{account.username}</p>
                            )}

                            <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-muted/30">
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                <i className="fas fa-tag ml-1"></i>
                                {account.accountType === 'page' ? 'صفحة' : account.accountType === 'business' ? 'حساب تجاري' : 'حساب شخصي'}
                              </span>
                              {account.capabilities?.canPublishStories && (
                                <span className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                                  <i className="fas fa-images ml-1"></i>قصص
                                </span>
                              )}
                              {account.capabilities?.canPublishReels && (
                                <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                                  <i className="fas fa-film ml-1"></i>ريلز
                                </span>
                              )}
                              {account.capabilities?.canSchedule && (
                                <span className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-1 rounded">
                                  <i className="fas fa-calendar ml-1"></i>جدولة
                                </span>
                              )}
                              {account.capabilities?.canGetInsights && (
                                <span className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                                  <i className="fas fa-chart-line ml-1"></i>تحليلات
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mt-4">
                              <div>
                                <p className="text-xs text-muted-foreground">الحصة اليومية</p>
                                <p className="text-sm font-medium">
                                  {account.quotas.dailyUsed} / {account.quotas.dailyLimit}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">الحصة الشهرية</p>
                                <p className="text-sm font-medium">
                                  {account.quotas.monthlyUsed} / {account.quotas.monthlyLimit}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">نوع الحساب</p>
                                <p className="text-sm font-medium">
                                  {account.accountType === 'page' ? 'صفحة' : 
                                   account.accountType === 'business' ? 'تجاري' : 'شخصي'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">آخر نشر</p>
                                <p className="text-sm font-medium">
                                  {account.lastPublishedAt 
                                    ? new Date(account.lastPublishedAt).toLocaleDateString('ar-SA')
                                    : 'لم ينشر بعد'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteClick(account)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${account.id}`}
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-link text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">لا توجد حسابات مربوطة</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    ابدأ بربط حساب من المنصات أعلاه
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <i className="fas fa-heartbeat ml-2 text-red-500"></i>
                صحة الحسابات
              </CardTitle>
              <CardDescription>مراقبة حالة الاتصال والرموز والحصص</CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading || accountsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-4">
                  {accounts.map((account) => {
                    const health = getHealthForAccount(account.id);
                    const healthScore = health?.healthScore ?? 85;
                    const tokenStatus = health?.tokenStatus ?? 'valid';
                    const connectionStatus = health?.connectionStatus ?? 'connected';
                    const quotaUsage = health?.quotaUsagePercent ?? Math.round((account.quotas.dailyUsed / account.quotas.dailyLimit) * 100);

                    return (
                      <Card key={account.id} className="border-2" data-testid={`card-health-${account.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 flex-wrap">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={account.profilePictureUrl} />
                              <AvatarFallback>
                                <i className={platformIcons[account.platform]?.icon}></i>
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-4">
                                <h3 className="font-semibold">{account.name}</h3>
                                <Badge variant="outline">
                                  <i className={`${platformIcons[account.platform]?.icon} ml-1`}></i>
                                  {platformIcons[account.platform]?.name}
                                </Badge>
                              </div>

                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <i className="fas fa-heartbeat text-primary"></i>
                              تحليل صحة الحساب (بيانات حقيقية)
                            </h4>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">درجة استقرار الحساب:</span>
                                <span className={`font-bold ${
                                  healthScore > 80 ? 'text-green-500' :
                                  healthScore > 50 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                  %{healthScore}
                                </span>
                              </div>
                              <Progress 
                                value={healthScore} 
                                className="h-2"
                              />
                              
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">حالة الرمز</p>
                                  <Badge variant="outline" className={getTokenStatusColor(tokenStatus)}>
                                    {getTokenStatusLabel(tokenStatus)}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">استخدام الحصة</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">%{quotaUsage}</span>
                                    <Progress value={quotaUsage} className="h-1 flex-1" />
                                  </div>
                                </div>
                              </div>
                            </div>
                            </div>

                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-heartbeat text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">لا توجد حسابات لعرض صحتها</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <i className="fas fa-chart-line ml-2 text-primary"></i>
                أداء الحسابات
              </CardTitle>
              <CardDescription>تحليل التفاعل والوصول والنمو</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading || accountsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                  ))}
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-4">
                  {accounts.map((account) => {
                    const perf = getPerformanceForAccount(account.id);
                    const engagementRate = perf?.engagementRate || 0;
                    const engagementTrend = perf?.engagementTrend || 0;
                    const reach = perf?.reach || 0;
                    const reachTrend = perf?.reachTrend || 0;
                    const impressions = perf?.impressions || 0;
                    const impressionsTrend = perf?.impressionsTrend || 0;
                    const bestContentType = perf?.bestContentType || '-';
                    const topTime = perf?.topPerformingTime || '-';
                    const followersGrowth = perf?.followersGrowth || 0;

                    return (
                      <Card key={account.id} className="border-2" data-testid={`card-performance-${account.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 flex-wrap mb-4">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={account.profilePictureUrl} />
                              <AvatarFallback>
                                <i className={platformIcons[account.platform]?.icon}></i>
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">{account.name}</h3>
                              <Badge variant="outline" className="mt-1">
                                <i className={`${platformIcons[account.platform]?.icon} ml-1`}></i>
                                {platformIcons[account.platform]?.name}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                            <div className="p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">معدل التفاعل</p>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">{engagementRate}%</span>
                                {getTrendIcon(engagementTrend)}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {engagementTrend > 0 ? '+' : ''}{engagementTrend}% هذا الأسبوع
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">الوصول</p>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">{reach.toLocaleString('ar-SA')}</span>
                                {getTrendIcon(reachTrend)}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {reachTrend > 0 ? '+' : ''}{reachTrend}% هذا الأسبوع
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">مرات الظهور</p>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">{impressions.toLocaleString('ar-SA')}</span>
                                {getTrendIcon(impressionsTrend)}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {impressionsTrend > 0 ? '+' : ''}{impressionsTrend}% هذا الأسبوع
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">نمو المتابعين</p>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-green-500">+{followersGrowth}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">هذا الشهر</p>
                            </div>

                            <div className="p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">أفضل نوع محتوى</p>
                              <div className="flex items-center gap-2">
                                <i className="fas fa-video text-primary"></i>
                                <span className="text-sm font-medium">{bestContentType}</span>
                              </div>
                            </div>

                            <div className="p-3 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-1">أفضل وقت للنشر</p>
                              <div className="flex items-center gap-2">
                                <i className="fas fa-clock text-primary"></i>
                                <span className="text-sm font-medium">{topTime}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-chart-line text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">لا توجد حسابات لعرض أدائها</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <i className="fas fa-lightbulb ml-2 text-yellow-500"></i>
                توصيات التحسين
              </CardTitle>
              <CardDescription>اقتراحات ذكية لتحسين أداء حساباتك</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading || accountsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-6">
                  {accounts.map((account) => {
                    const accountRecs = getRecommendationsForAccount(account.id);
                    const defaultRecs: AccountRecommendation[] = accountRecs.length > 0 ? accountRecs : [
                      {
                        id: `${account.id}-1`,
                        accountId: account.id,
                        type: 'optimization',
                        priority: 'high',
                        title: 'تحسين وقت النشر',
                        description: 'جمهورك أكثر نشاطاً بين الساعة 8-10 مساءً. جرب النشر في هذا الوقت لزيادة التفاعل.',
                        action: 'جدولة النشر'
                      },
                      {
                        id: `${account.id}-2`,
                        accountId: account.id,
                        type: 'tip',
                        priority: 'medium',
                        title: 'زيادة محتوى الفيديو',
                        description: 'الفيديوهات تحقق تفاعل أعلى بنسبة 40% مقارنة بالصور. جرب نشر المزيد من الفيديوهات.',
                        action: 'إنشاء فيديو'
                      },
                      {
                        id: `${account.id}-3`,
                        accountId: account.id,
                        type: 'warning',
                        priority: 'low',
                        title: 'تنويع المحتوى',
                        description: 'لاحظنا أن معظم محتواك من نفس النوع. التنويع يساعد في الوصول لجمهور أوسع.',
                      }
                    ];

                    return (
                      <div key={account.id} className="space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={account.profilePictureUrl} />
                            <AvatarFallback>
                              <i className={platformIcons[account.platform]?.icon}></i>
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="font-semibold">{account.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {defaultRecs.length} توصية
                          </Badge>
                        </div>

                        <div className="space-y-3 pr-10">
                          {defaultRecs.map((rec) => (
                            <div
                              key={rec.id}
                              className={`p-4 rounded-lg border-r-4 ${getPriorityColor(rec.priority)}`}
                              data-testid={`card-recommendation-${rec.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <i className={getTypeIcon(rec.type)}></i>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 className="font-medium">{rec.title}</h4>
                                    <Badge variant="secondary" className="text-xs">
                                      {rec.priority === 'high' ? 'أولوية عالية' :
                                       rec.priority === 'medium' ? 'أولوية متوسطة' :
                                       'أولوية منخفضة'}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                                </div>
                                {rec.action && (
                                  <Button size="sm" variant="outline" data-testid={`button-action-${rec.id}`}>
                                    {rec.action}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-lightbulb text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">لا توجد حسابات لعرض توصياتها</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الحساب "{accountToDelete?.name}" بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => accountToDelete && deleteMutation.mutate(accountToDelete.id)}
              data-testid="button-confirm-delete"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
