import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";

interface CronSchedulerStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  storiesInQueue: number;
  storiesPublishedToday: number;
  failedPublications: number;
  successfulPublications: number;
  uptime: number;
  cronExpression: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface CronPublishResult {
  success: boolean;
  storyId: string;
  platform: string;
  accountId: string;
  message?: string;
  error?: string;
  timestamp: string;
}

interface CronQueuedStory {
  story: {
    id: string;
    content: string;
    platforms: string[];
    status: string;
    scheduledTime: string;
    videoGenerationStatus?: string;
  };
  retryCount: number;
  lastAttempt: string | null;
  nextRetryAt: string | null;
  addedAt: string;
  errorHistory: string[];
}

interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
  activeConnections: number;
  responseTime: number;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} يوم، ${hours % 24} ساعة`;
  } else if (hours > 0) {
    return `${hours} ساعة، ${minutes % 60} دقيقة`;
  } else if (minutes > 0) {
    return `${minutes} دقيقة`;
  } else {
    return `${seconds} ثانية`;
  }
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'غير محدد';
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'منذ لحظات';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

function isAccessDeniedError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as any;
    if (errorObj.status === 403) return true;
    if (errorObj.response?.status === 403) return true;
    if (errorObj.statusCode === 403) return true;
  }
  const errStr = String(error);
  return errStr.includes('403') || errStr.includes('Forbidden') || errStr.includes('Admin access required');
}

export default function Jobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCronExpression, setNewCronExpression] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: cronStatus, isLoading: cronStatusLoading, refetch: refetchCronStatus } = useQuery<CronSchedulerStatus | undefined>({
    queryKey: ["/api/cron/status"],
    refetchInterval: autoRefresh ? 5000 : false,
    select: (data: any) => {
      if (!data || data.success !== true || !data.status) return undefined;
      return data.status as CronSchedulerStatus;
    },
  });

  const { data: cronResults, isLoading: cronResultsLoading, error: cronResultsError, isError: isResultsError } = useQuery<CronPublishResult[]>({
    queryKey: ["/api/admin/cron/results"],
    refetchInterval: autoRefresh ? 10000 : false,
    select: (data: any) => {
      if (!data || data.success !== true) return [];
      return (data.results || []) as CronPublishResult[];
    },
    retry: false,
  });

  const { data: cronQueue, isLoading: cronQueueLoading, refetch: refetchCronQueue, error: cronQueueError, isError: isQueueError } = useQuery<CronQueuedStory[]>({
    queryKey: ["/api/admin/cron/queue"],
    refetchInterval: autoRefresh ? 10000 : false,
    select: (data: any) => {
      if (!data || data.success !== true) return [];
      return (data.queue || []).map((item: any) => ({
        story: item.story || {},
        retryCount: item.retryCount || 0,
        lastAttempt: item.lastAttempt || null,
        nextRetryAt: item.nextRetryAt || null,
        addedAt: item.addedAt || new Date().toISOString(),
        errorHistory: item.errorHistory || [],
      })) as CronQueuedStory[];
    },
    retry: false,
  });

  const { data: systemHealth, error: systemHealthError, isError: isHealthError } = useQuery<SystemHealth | undefined>({
    queryKey: ["/api/admin/system-health"],
    refetchInterval: autoRefresh ? 30000 : false,
    retry: false,
    select: (data: any) => {
      if (!data || data.success !== true) return undefined;
      return data.health as SystemHealth;
    },
  });

  const hasAccessError = (isResultsError && isAccessDeniedError(cronResultsError)) || 
                         (isQueueError && isAccessDeniedError(cronQueueError)) ||
                         (isHealthError && isAccessDeniedError(systemHealthError));

  const triggerCronMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/cron/trigger", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "تم تشغيل الجدولة",
        description: `تمت معالجة ${data.results?.published || 0} قصة بنجاح`,
      });
      refetchCronStatus();
      refetchCronQueue();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cron/results"] });
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCronScheduleMutation = useMutation({
    mutationFn: async (cronExpression: string) => {
      return await apiRequest("POST", "/api/admin/cron/update-schedule", { cronExpression });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "تم التحديث",
          description: "تم تحديث جدول التشغيل بنجاح",
        });
        setNewCronExpression("");
        refetchCronStatus();
      } else {
        toast({
          title: "تعبير غير صالح",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const retryStoryMutation = useMutation({
    mutationFn: async (storyId: string) => {
      return await apiRequest("POST", `/api/admin/cron/retry/${storyId}`, {});
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "تم إعادة المحاولة",
          description: "تم نشر القصة بنجاح",
        });
      } else {
        toast({
          title: "فشلت إعادة المحاولة",
          description: data.message,
          variant: "destructive",
        });
      }
      refetchCronQueue();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cron/results"] });
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearFailedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/cron/clear-failed", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "تم التنظيف",
        description: `تم إزالة ${data.clearedCount || 0} قصة فاشلة من قائمة الانتظار`,
      });
      refetchCronQueue();
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getHealthColor = (status: string | undefined) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthText = (status: string | undefined) => {
    switch (status) {
      case 'healthy': return 'سليم';
      case 'degraded': return 'متدهور';
      case 'unhealthy': return 'غير سليم';
      default: return 'غير معروف';
    }
  };

  const getVideoStatusBadge = (videoStatus: string | undefined) => {
    switch (videoStatus) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-2 h-5">
            <i className="fas fa-hourglass-half ml-1"></i>
            قيد الانتظار
          </Badge>
        );
      case 'generating':
        return (
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-2 h-5 animate-pulse">
            <i className="fas fa-spinner fa-spin ml-1"></i>
            جاري الإنشاء
          </Badge>
        );
      case 'generated':
        return (
          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 h-5">
            <i className="fas fa-check ml-1"></i>
            فيديو جاهز
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs px-2 h-5">
            <i className="fas fa-exclamation-circle ml-1"></i>
            خطأ في الإنشاء
          </Badge>
        );
      default:
        return null;
    }
  };

  const successRate = cronStatus 
    ? cronStatus.successfulPublications + cronStatus.failedPublications > 0
      ? Math.round((cronStatus.successfulPublications / (cronStatus.successfulPublications + cronStatus.failedPublications)) * 100)
      : 100
    : 0;

  if (hasAccessError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10 mb-6">
          <i className="fas fa-lock text-4xl text-yellow-500"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2">صلاحيات محدودة</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          بعض وظائف إدارة المهام تتطلب صلاحيات المسؤول. يمكنك مشاهدة حالة المجدول فقط.
        </p>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <i className="fas fa-tachometer-alt text-primary"></i>
              حالة المجدول
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-3">
                <i className="fas fa-play-circle text-green-500"></i>
                <span className="text-sm font-medium">حالة التشغيل</span>
              </div>
              <Badge variant={cronStatus?.isRunning ? "default" : "secondary"}>
                {cronStatus?.isRunning ? 'يعمل' : 'متوقف'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-3">
                <i className="fas fa-heartbeat text-primary"></i>
                <span className="text-sm font-medium">الصحة</span>
              </div>
              <Badge className={getHealthColor(cronStatus?.healthStatus)}>
                {getHealthText(cronStatus?.healthStatus)}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-3">
                <i className="fas fa-check-circle text-green-500"></i>
                <span className="text-sm font-medium">منشور اليوم</span>
              </div>
              <span className="text-sm font-bold">{cronStatus?.storiesPublishedToday || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة المهام</h1>
          <p className="text-muted-foreground mt-2">مراقبة وإدارة مهام النشر المجدولة</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              data-testid="switch-auto-refresh"
            />
            <Label className="text-sm">تحديث تلقائي</Label>
          </div>
          <Button
            onClick={() => {
              refetchCronStatus();
              refetchCronQueue();
            }}
            variant="outline"
            size="icon"
            data-testid="button-refresh-all"
          >
            <i className="fas fa-sync-alt"></i>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate" data-testid="card-scheduler-status">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">حالة المجدول</CardTitle>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${getHealthColor(cronStatus?.healthStatus)}/10`}>
              <div className={`h-3 w-3 rounded-full ${getHealthColor(cronStatus?.healthStatus)} animate-pulse`}></div>
            </div>
          </CardHeader>
          <CardContent>
            {cronStatusLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-health-status">
                  {cronStatus?.isRunning ? 'يعمل' : (cronStatus?.lastRun ? 'نشط (عبر GitHub Actions)' : 'متوقف')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getHealthText(cronStatus?.healthStatus)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-published-today">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">منشور اليوم</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
              <i className="fas fa-check-circle"></i>
            </div>
          </CardHeader>
          <CardContent>
            {cronStatusLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-published-today">
                  {cronStatus?.storiesPublishedToday || 0}
                </div>
                <p className="text-xs text-muted-foreground">قصة</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-queue-size">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">في الانتظار</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <i className="fas fa-clock"></i>
            </div>
          </CardHeader>
          <CardContent>
            {cronStatusLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-queue-size">
                  {cronStatus?.storiesInQueue || 0}
                </div>
                <p className="text-xs text-muted-foreground">قصة</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-success-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">معدل النجاح</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <i className="fas fa-chart-line"></i>
            </div>
          </CardHeader>
          <CardContent>
            {cronStatusLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-success-rate">
                  {successRate}%
                </div>
                <Progress value={successRate} className="h-2 mt-2" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status" data-testid="tab-status">
            <i className="fas fa-tachometer-alt ml-2"></i>
            الحالة
          </TabsTrigger>
          <TabsTrigger value="queue" data-testid="tab-queue">
            <i className="fas fa-list ml-2"></i>
            قائمة الانتظار
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <i className="fas fa-history ml-2"></i>
            السجل
          </TabsTrigger>
          <TabsTrigger value="controls" data-testid="tab-controls">
            <i className="fas fa-cogs ml-2"></i>
            التحكم
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-system-status">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-server text-primary"></i>
                  حالة النظام
                </CardTitle>
                <CardDescription>معلومات تفصيلية عن حالة خدمة الجدولة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cronStatusLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-play-circle text-green-500"></i>
                        <span className="text-sm font-medium">حالة التشغيل</span>
                      </div>
                      <Badge variant={cronStatus?.isRunning ? "default" : "secondary"}>
                        {cronStatus?.isRunning ? 'يعمل' : (cronStatus?.lastRun ? 'يعمل (عبر GitHub Actions)' : 'متوقف')}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-heartbeat text-primary"></i>
                        <span className="text-sm font-medium">الصحة</span>
                      </div>
                      <Badge className={getHealthColor(cronStatus?.healthStatus)}>
                        {getHealthText(cronStatus?.healthStatus)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-clock text-blue-500"></i>
                        <span className="text-sm font-medium">وقت التشغيل</span>
                      </div>
                      <span className="text-sm font-mono">
                        {cronStatus?.uptime ? formatUptime(cronStatus.uptime) : '0 دقيقة'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-calendar text-purple-500"></i>
                        <span className="text-sm font-medium">جدول التشغيل</span>
                      </div>
                      <span className="text-sm font-mono" dir="ltr">
                        {cronStatus?.cronExpression || '* * * * *'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-history text-orange-500"></i>
                        <span className="text-sm font-medium">آخر تشغيل</span>
                      </div>
                      <span className="text-sm">
                        {formatTimeAgo(cronStatus?.lastRun ?? null)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-forward text-cyan-500"></i>
                        <span className="text-sm font-medium">التشغيل القادم</span>
                      </div>
                      <span className="text-sm font-medium text-primary">
                        {cronStatus?.nextRun 
                          ? new Date(cronStatus.nextRun).toLocaleTimeString('ar-SA')
                          : 'غير محدد'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-performance-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-chart-pie text-primary"></i>
                  مقاييس الأداء
                </CardTitle>
                <CardDescription>إحصائيات عمليات النشر اليوم</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>معدل النجاح الإجمالي</span>
                    <span className="font-bold text-green-500">{successRate}%</span>
                  </div>
                  <Progress value={successRate} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-xs text-muted-foreground mb-1">نجاح</p>
                    <p className="text-2xl font-bold text-green-500">{cronStatus?.successfulPublications || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                    <p className="text-xs text-muted-foreground mb-1">فشل</p>
                    <p className="text-2xl font-bold text-red-500">{cronStatus?.failedPublications || 0}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-info-circle text-primary"></i>
                    ملاحظات النظام
                  </h4>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1"></span>
                      يتم تشغيل المجدول تلقائياً حسب التوقيت المحدد.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1"></span>
                      المهام الفاشلة تبقى في القائمة لإعادة المحاولة.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <Card data-testid="card-task-queue">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>قائمة المهام المنتظرة</CardTitle>
                <CardDescription>القصص المجدولة التي سيتم نشرها قريباً</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => clearFailedMutation.mutate()}
                  disabled={clearFailedMutation.isPending || !cronQueue?.length}
                  data-testid="button-clear-failed"
                >
                  <i className="fas fa-trash-alt ml-2"></i>
                  تنظيف الفاشلة
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchCronQueue()}
                  data-testid="button-refresh-queue"
                >
                  <i className="fas fa-sync-alt ml-2"></i>
                  تحديث القائمة
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {cronQueueLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : cronQueue && cronQueue.length > 0 ? (
                  <div className="space-y-4">
                    {cronQueue.map((item) => (
                      <div 
                        key={item.story.id} 
                        className="p-4 rounded-lg border bg-card hover-elevate group"
                        data-testid={`queue-item-${item.story.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-[10px]" data-testid={`badge-story-id-${item.story.id}`}>
                                ID: {item.story.id.substring(0, 8)}
                              </Badge>
                              <Badge variant={item.story.status === 'error' ? 'destructive' : 'secondary'} className="text-xs" data-testid={`badge-status-${item.story.id}`}>
                                {item.story.status === 'error' ? 'فشل' : 'مجدول'}
                              </Badge>
                              {getVideoStatusBadge(item.story.videoGenerationStatus)}
                              {item.retryCount > 0 && (
                                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200" data-testid={`badge-retries-${item.story.id}`}>
                                  محاولة {item.retryCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium line-clamp-2" data-testid={`text-content-${item.story.id}`}>
                              {item.story.content}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <i className="fas fa-calendar"></i>
                                جدول: {new Date(item.story.scheduledTime).toLocaleString('ar-EG')}
                              </span>
                              {item.addedAt && (
                                <span className="flex items-center gap-1">
                                  <i className="fas fa-plus-circle"></i>
                                  أضيفت: {new Date(item.addedAt).toLocaleTimeString('ar-EG')}
                                </span>
                              )}
                              <div className="flex gap-1">
                                {item.story.platforms.map(p => (
                                  <Badge key={p} variant="outline" className="capitalize px-1 py-0 h-4 text-[10px]">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {(item.lastAttempt || item.nextRetryAt) && (
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
                                {item.lastAttempt && (
                                  <span className="flex items-center gap-1">
                                    <i className="fas fa-history text-orange-500"></i>
                                    آخر محاولة: {new Date(item.lastAttempt).toLocaleTimeString('ar-EG')}
                                  </span>
                                )}
                                {item.nextRetryAt && (
                                  <span className="flex items-center gap-1">
                                    <i className="fas fa-redo text-blue-500"></i>
                                    إعادة في: {new Date(item.nextRetryAt).toLocaleTimeString('ar-EG')}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.errorHistory.length > 0 && (
                              <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/10 text-[10px] text-red-500" data-testid={`text-error-${item.story.id}`}>
                                <i className="fas fa-exclamation-triangle ml-1"></i>
                                {item.errorHistory[item.errorHistory.length - 1]}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => retryStoryMutation.mutate(item.story.id)}
                              disabled={retryStoryMutation.isPending}
                              data-testid={`button-retry-${item.story.id}`}
                            >
                              <i className="fas fa-redo ml-1"></i>
                              إعادة
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                    <i className="fas fa-clipboard-list text-4xl mb-4 opacity-20"></i>
                    <p>قائمة الانتظار فارغة حالياً</p>
                    <Link href="/schedule">
                      <Button variant="outline" className="mt-2">جدولة قصة جديدة</Button>
                    </Link>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card data-testid="card-history">
            <CardHeader>
              <CardTitle>سجل النشر</CardTitle>
              <CardDescription>نتائج عمليات النشر السابقة</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {cronResultsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : cronResults && cronResults.length > 0 ? (
                  <div className="space-y-3">
                    {cronResults.map((result, idx) => (
                      <div 
                        key={`${result.storyId}-${idx}`}
                        className="p-3 rounded-lg border bg-card flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                        data-testid={`history-item-${idx}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${result.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <i className={`fas ${result.success ? 'fa-check' : 'fa-times'}`}></i>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold capitalize" data-testid={`text-platform-${idx}`}>{result.platform}</span>
                              <Badge variant="outline" className="text-[10px] h-4" data-testid={`text-account-${idx}`}>Account: {result.accountId.substring(0, 8)}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground" data-testid={`text-message-${idx}`}>
                              {result.success ? (result.message || 'تم النشر بنجاح') : (result.error || 'فشل النشر')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono" data-testid={`text-timestamp-${idx}`}>
                            {new Date(result.timestamp).toLocaleTimeString('ar-EG')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(result.timestamp).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <i className="fas fa-history text-4xl mb-4 opacity-20"></i>
                    <p>لا يوجد سجل للنشر بعد</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-manual-controls">
              <CardHeader>
                <CardTitle>التحكم اليدوي</CardTitle>
                <CardDescription>تشغيل المجدول يدوياً لتجربة النشر</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
                  <h4 className="text-sm font-semibold">تشغيل المجدول الآن</h4>
                  <p className="text-xs text-muted-foreground">
                    سيقوم هذا الإجراء بالبحث عن أي قصص مجدولة للوقت الحالي ونشرها على المنصات المحددة.
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => triggerCronMutation.mutate()}
                    disabled={triggerCronMutation.isPending}
                    data-testid="button-trigger-manual"
                  >
                    <i className="fas fa-play ml-2"></i>
                    {triggerCronMutation.isPending ? 'جاري المعالجة...' : 'تشغيل يدوي فوري'}
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/10 space-y-3">
                  <h4 className="text-sm font-semibold">تحديث جدول التشغيل</h4>
                  <p className="text-xs text-muted-foreground">
                    تغيير تعبير Cron لتغيير وتيرة النشر الآلي.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="0 9 * * *" 
                      className="font-mono text-center" 
                      dir="ltr"
                      value={newCronExpression}
                      onChange={(e) => setNewCronExpression(e.target.value)}
                      data-testid="input-cron-expression"
                    />
                    <Button 
                      variant="secondary"
                      onClick={() => updateCronScheduleMutation.mutate(newCronExpression)}
                      disabled={updateCronScheduleMutation.isPending || !newCronExpression}
                      data-testid="button-update-schedule"
                    >
                      تحديث
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    مثال: <code className="bg-muted px-1 rounded">0 9 * * *</code> (يومياً الساعة 9 صباحاً)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-info">
              <CardHeader>
                <CardTitle>معلومات الخادم</CardTitle>
                <CardDescription>تفاصيل الموارد وحالة الاتصال</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemHealth ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>استخدام المعالج</span>
                        <span>{systemHealth.cpu}%</span>
                      </div>
                      <Progress value={systemHealth.cpu} className="h-1.5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>استخدام الذاكرة</span>
                        <span>{systemHealth.memory}%</span>
                      </div>
                      <Progress value={systemHealth.memory} className="h-1.5" />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">وقت التشغيل</p>
                        <p className="text-sm font-medium">{systemHealth.uptime}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">الاتصالات النشطة</p>
                        <p className="text-sm font-medium">{systemHealth.activeConnections}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-10 opacity-50">
                    <i className="fas fa-server text-3xl"></i>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
