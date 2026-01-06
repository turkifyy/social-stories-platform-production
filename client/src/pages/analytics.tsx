import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryAnalytics } from "@shared/schema";

export default function Analytics() {
  const { data: categoryStats, isLoading: categoryLoading } = useQuery<CategoryAnalytics[]>({
    queryKey: ["/api/analytics/categories"],
  });

  const categoryData = [
    { id: "movies", name: "أفلام", icon: "fa-film", color: "bg-blue-500" },
    { id: "tv_shows", name: "مسلسلات", icon: "fa-tv", color: "bg-purple-500" },
    { id: "sports", name: "رياضة", icon: "fa-futbol", color: "bg-green-500" },
    { id: "recipes", name: "وصفات", icon: "fa-utensils", color: "bg-orange-500" },
    { id: "gaming", name: "ألعاب", icon: "fa-gamepad", color: "bg-red-500" },
    { id: "apps", name: "تطبيقات", icon: "fa-mobile-screen", color: "bg-cyan-500" },
  ];

  const maxCount = Math.max(...(categoryStats?.map((c) => c.count) || [1]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">التحليلات</h1>
        <p className="text-muted-foreground mt-2">تتبع أداء قصصك وتحليل البيانات</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>أداء الفئات</CardTitle>
            <CardDescription>مقارنة عدد القصص ومعدل التفاعل لكل فئة</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryLoading ? (
              <div className="space-y-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : categoryStats && categoryStats.length > 0 ? (
              <div className="space-y-6">
                {categoryData.map((cat) => {
                  const stats = categoryStats.find((s) => s.category === cat.id);
                  const percentage = stats ? (stats.count / maxCount) * 100 : 0;

                  return (
                    <div key={cat.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cat.color} text-white`}>
                            <i className={`fas ${cat.icon}`}></i>
                          </div>
                          <div>
                            <p className="font-medium">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {stats?.count || 0} قصة - معدل التفاعل: {(stats?.averageEngagement || 0).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-muted-foreground">
                          {stats?.count || 0}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-chart-bar text-5xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground">لا توجد بيانات تحليلية بعد</p>
                <p className="text-sm text-muted-foreground mt-2">ابدأ بإنشاء قصص لرؤية التحليلات</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-fire text-orange-500"></i>
                الفئة الأكثر نشاطاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : categoryStats && categoryStats.length > 0 ? (
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {categoryData.find((c) => c.id === categoryStats[0]?.category)?.name || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {categoryStats[0]?.count || 0} قصة
                  </p>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-star text-yellow-500"></i>
                أعلى معدل تفاعل
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : categoryStats && categoryStats.length > 0 ? (
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {Math.max(...categoryStats.map((c) => c.averageEngagement)).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">معدل التفاعل</p>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-layer-group text-primary"></i>
                إجمالي القصص
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : categoryStats && categoryStats.length > 0 ? (
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {categoryStats.reduce((sum, c) => sum + c.count, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">قصة منشورة</p>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">0</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
