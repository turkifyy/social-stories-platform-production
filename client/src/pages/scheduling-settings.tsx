import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { autoStoryGenerationSettingsSchema, type AutoStoryGenerationSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Loader2, Github, CheckCircle2, ExternalLink } from "lucide-react";

export default function SchedulingSettings() {
  const { toast } = useToast();
  const [repoName, setRepoName] = useState("social-stories-scheduler");
  const [isSettingUpGithub, setIsSettingUpGithub] = useState(false);
  const [githubResult, setGithubResult] = useState<{ url: string } | null>(null);

  const { data: settings, isLoading } = useQuery<AutoStoryGenerationSettings>({
    queryKey: ["/api/settings/auto-story"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: AutoStoryGenerationSettings) => {
      const res = await apiRequest("POST", "/api/settings/auto-story", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/auto-story"] });
      toast({ title: "تم الحفظ بنجاح", description: "تم تحديث إعدادات الجدولة." });
    },
  });

  const setupGithubMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/admin/github/setup", { repoName: name });
      return res.json();
    },
    onSuccess: (data) => {
      setGithubResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/auto-story"] });
      toast({ title: "تم الإعداد بنجاح", description: "تم ربط GitHub وتفعيل المجدول." });
    },
    onSettled: () => setIsSettingUpGithub(false),
  });

  const form = useForm<AutoStoryGenerationSettings>({
    resolver: zodResolver(autoStoryGenerationSettingsSchema),
    defaultValues: settings || {
      enabled: false,
      publishTime: "09:00",
      categories: ["movies", "sports", "recipes"],
      platforms: ["facebook"],
      format: "story",
      withMusic: true,
      withVideo: true,
      videoGenerationHoursBefore: 2,
    },
  });

  useEffect(() => {
    if (settings) form.reset(settings);
  }, [settings, form]);

  const onSubmit = (data: AutoStoryGenerationSettings) => {
    updateSettingsMutation.mutate(data);
  };

  const handleGithubSetup = () => {
    setIsSettingUpGithub(true);
    setupGithubMutation.mutate(repoName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-4xl rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إعدادات الجدولة والأتمتة</h1>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <Github className="w-3 h-3 ml-1" />
          GitHub Actions Powered
        </Badge>
      </div>

      <div className="grid gap-6">
        <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                حالة نظام الجدولة الذكي
              </div>
              {settings?.enabled && (
                <Badge className="bg-green-500 text-white border-0">نشط (GitHub Actions)</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-blue-800/80 dark:text-blue-200/80">
              يتم تشغيل المهام تلقائياً عبر GitHub كل 5 دقائق لضمان دقة المواعيد وتوفير الموارد.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-purple-200 bg-purple-50/30 dark:border-purple-900/50 dark:bg-purple-950/20">
          <CardHeader>
            <CardTitle className="text-purple-900 dark:text-purple-100 flex items-center gap-2">
              <Github className="w-5 h-5" />
              ربط GitHub التلقائي
            </CardTitle>
            <CardDescription className="text-purple-800/80 dark:text-purple-200/80">
              بضغطة زر واحدة، سيتم إنشاء مستودع خاص، رفع كافة ملفات المنصة، وإعداد نظام الجدولة ليعمل فوراً.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>اسم المستودع على GitHub</Label>
                <div className="flex gap-2">
                  <Input 
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="bg-white dark:bg-black/40"
                    placeholder="my-social-scheduler"
                  />
                  <Button 
                    onClick={handleGithubSetup}
                    disabled={isSettingUpGithub}
                    className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                  >
                    {isSettingUpGithub ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Github className="w-4 h-4 ml-2" />}
                    إعداد الآن
                  </Button>
                </div>
              </div>

              {githubResult && (
                <div className="p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950/30 rounded-lg space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      تم الإعداد بنجاح!
                    </h4>
                    <Button variant="ghost" size="sm" asChild className="text-green-700">
                      <a href={githubResult.url} target="_blank" rel="noreferrer">
                        فتح المستودع
                        <ExternalLink className="w-3 h-3 mr-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إعدادات الجيل التلقائي</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>الجيل التلقائي للقصص</FormLabel>
                        <FormDescription>تفعيل أو تعطيل إنشاء القصص تلقائياً.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  حفظ الإعدادات
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
