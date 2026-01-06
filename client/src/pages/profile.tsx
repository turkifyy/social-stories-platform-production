import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings, UpdateSettings } from "@shared/schema";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/accounts/stats"],
  });

  const { data: insights } = useQuery<any>({
    queryKey: ["/api/insights"],
  });

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");

  // Sync state when user data is available
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setBio(user.bio || "");
      setCompany(user.company || "");
    }
  }, [user]);

  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      return await apiRequest("PATCH", `/api/users/${user?.id}`, updates);
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث الملف الشخصي",
        description: "تم حفظ التغييرات بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في التحديث",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      displayName,
      bio,
      company
    });
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: UpdateSettings) => {
      return await apiRequest("PUT", "/api/settings", updates);
    },
    onSuccess: () => {
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث إعداداتك",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">الملف الشخصي</h1>
        <p className="text-muted-foreground mt-2">إدارة معلوماتك الشخصية وإعداداتك</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>المعلومات الشخصية</CardTitle>
            <CardDescription>قم بتحديث معلومات حسابك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.photoURL} />
                <AvatarFallback className="text-2xl">{getInitials(user?.displayName || "User")}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-lg">{user?.displayName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  <i className="fas fa-user ml-2"></i>
                  الاسم الكامل
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="input-displayName"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <i className="fas fa-envelope ml-2"></i>
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">
                  <i className="fas fa-align-left ml-2"></i>
                  النبذة الشخصية
                </Label>
                <Input
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="اكتب نبذة قصيرة عنك"
                  data-testid="input-bio"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="company">
                  <i className="fas fa-building ml-2"></i>
                  الشركة
                </Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="اسم الشركة"
                  data-testid="input-company"
                />
              </div>
            </div>

            <Button 
              onClick={handleSaveProfile} 
              className="w-full" 
              data-testid="button-save-profile"
              disabled={updateProfileMutation.isPending}
            >
              <i className={`fas ${updateProfileMutation.isPending ? 'fa-spinner fa-spin' : 'fa-save'} ml-2`}></i>
              {updateProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إحصائيات الحساب</CardTitle>
              <CardDescription>نظرة عامة على الأداء الحقيقي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center hover-elevate transition-all">
                  <p className="text-3xl font-black text-primary mb-1">{userStats?.totalFollowers?.toLocaleString() || 0}</p>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">المتابعون</p>
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center hover-elevate transition-all">
                  <p className="text-3xl font-black text-primary mb-1">{userStats?.avgEngagement?.toFixed(1) || 0}%</p>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">التفاعل</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div className="flex items-center gap-2">
                  <i className="fas fa-calendar-alt text-primary"></i>
                  <span className="text-sm font-medium">تاريخ الإنشاء</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("ar-EG") : "-"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div className="flex items-center gap-2">
                  <i className="fas fa-id-card text-primary"></i>
                  <span className="text-sm font-medium">معرف المستخدم</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{user?.id.slice(0, 8)}...</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>تحليل البيانات</CardTitle>
              <Button 
                size="sm"
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/insights"] })}
              >
                <i className="fas fa-sync text-muted-foreground"></i>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">أفضل الأوقات للنشر</p>
                <div className="flex flex-wrap gap-2">
                  {insights?.bestPostingTimes?.map((time: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      <i className="fas fa-clock"></i>
                      <span>{time.dayName} {time.hour}:00</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">الفئات الأعلى أداءً</p>
                <div className="space-y-2">
                  {insights?.topPerformingCategories?.map((cat: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{cat.category}</span>
                      <span className="font-bold">{cat.averageEngagement}% تفاعل</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">الهاشتاجات الرائجة</p>
                <div className="flex flex-wrap gap-2">
                  {insights?.trendingHashtags?.map((tag: any, idx: number) => (
                    <div key={idx} className="px-2 py-0.5 rounded-full border border-border text-[10px] text-muted-foreground">
                      {tag.hashtag}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الإعدادات</CardTitle>
          <CardDescription>إدارة تفضيلاتك وإعدادات الخصوصية</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="notifications" className="border-none">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <i className="fas fa-bell text-primary"></i>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">الإشعارات</p>
                    <p className="text-xs text-muted-foreground">تخصيص كيفية تنبيهك بالتحديثات</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card/30">
                    <Label className="cursor-pointer">إشعارات البريد الإلكتروني</Label>
                    <Switch
                      checked={settings?.emailNotifications ?? true}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ emailNotifications: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card/30">
                    <Label className="cursor-pointer">إشعارات SMS</Label>
                    <Switch
                      checked={settings?.smsNotifications ?? false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ smsNotifications: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card/30">
                    <Label className="cursor-pointer">إشعارات الدفع</Label>
                    <Switch
                      checked={settings?.pushNotifications ?? true}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ pushNotifications: checked })
                      }
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="privacy" className="border-none">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <i className="fas fa-lock text-primary"></i>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">الخصوصية والأمان</p>
                    <p className="text-xs text-muted-foreground">التحكم في ظهور ملفك الشخصي</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card/30">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">ملف شخصي عام</Label>
                      <p className="text-[10px] text-muted-foreground">السماح لمحركات البحث بالعثور عليك</p>
                    </div>
                    <Switch
                      checked={settings?.publicProfile ?? false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ publicProfile: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card/30">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">عرض النشاط</Label>
                      <p className="text-[10px] text-muted-foreground">إظهار حالة اتصالك بالإنترنت</p>
                    </div>
                    <Switch
                      checked={settings?.showActivity ?? false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ showActivity: checked })
                      }
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ai-settings">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <i className="fas fa-brain text-primary"></i>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">إعدادات الذكاء الاصطناعي</p>
                    <p className="text-xs text-muted-foreground">تخصيص محرك توليد المحتوى الآلي</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4 px-1">
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">توليد القصص تلقائياً</Label>
                      <p className="text-sm text-muted-foreground">السماح للنظام بتوليد محتوى القصص تلقائياً بناءً على التريندات</p>
                    </div>
                    <Switch
                      checked={settings?.autoStoryGenerationEnabled ?? false}
                      disabled={updateSettingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ autoStoryGenerationEnabled: checked })
                      }
                      data-testid="switch-auto-generation"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">إضافة موسيقى ذكية</Label>
                      <p className="text-sm text-muted-foreground">اختيار موسيقى تناسب محتوى القصة تلقائياً باستخدام تحليل المشاعر</p>
                    </div>
                    <Switch
                      checked={settings?.autoStoryWithMusic ?? true}
                      disabled={updateSettingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ autoStoryWithMusic: checked })
                      }
                      data-testid="switch-auto-music"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">إنشاء فيديو تلقائي</Label>
                      <p className="text-sm text-muted-foreground">تحويل المحتوى النصي إلى فيديوهات احترافية عالية الجودة</p>
                    </div>
                    <Switch
                      checked={settings?.autoStoryWithVideo ?? false}
                      disabled={updateSettingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ autoStoryWithVideo: checked })
                      }
                      data-testid="switch-auto-video"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="auto-publish">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <i className="fas fa-robot text-primary"></i>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">النشر التلقائي الذكي</p>
                    <p className="text-xs text-muted-foreground">تحسين أوقات النشر والجدولة</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-4 px-1">
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50">
                    <div className="space-y-1">
                      <Label className="text-base">تفعيل النشر التلقائي</Label>
                      <p className="text-sm text-muted-foreground">نشر القصص تلقائياً في الأوقات التي يكون فيها جمهورك أكثر تفاعلاً</p>
                    </div>
                    <Switch
                      checked={settings?.autoPublish ?? true}
                      disabled={updateSettingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ autoPublish: checked })
                      }
                      data-testid="switch-auto-publish"
                    />
                  </div>

                  <div className="space-y-4 p-4 rounded-xl border bg-card/50">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="preferredTime" className="text-base">الوقت المفضل للنشر</Label>
                      {insights?.bestPostingTimes?.[0] && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          الوقت المقترح: {insights.bestPostingTimes[0].hour}:00
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Input
                        id="preferredTime"
                        type="time"
                        className="flex-1 h-11 text-lg font-mono"
                        value={settings?.preferredPublishTime || "12:00"}
                        onChange={(e) =>
                          updateSettingsMutation.mutate({ preferredPublishTime: e.target.value })
                        }
                        data-testid="input-preferred-time"
                      />
                      <Button 
                        variant="secondary"
                        size="default"
                        className="h-11 px-6 font-medium hover-elevate transition-all"
                        disabled={updateSettingsMutation.isPending || !insights?.bestPostingTimes?.[0]}
                        onClick={() => {
                          if (insights?.bestPostingTimes?.[0]) {
                            const bestHour = insights.bestPostingTimes[0].hour;
                            const formattedTime = `${bestHour.toString().padStart(2, '0')}:00`;
                            updateSettingsMutation.mutate({ preferredPublishTime: formattedTime });
                          }
                        }}
                      >
                        <i className="fas fa-magic ml-2"></i>
                        استخدم الذكاء
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-dashed">
                      <i className="fas fa-info-circle text-primary mt-1"></i>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        يقوم نظام الذكاء الاصطناعي بتحليل بيانات التفاعل التاريخية لجمهورك لتحديد أفضل 24 ساعة في الأسبوع للنشر، مما يضمن أقصى قدر من الوصول والتفاعل.
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
