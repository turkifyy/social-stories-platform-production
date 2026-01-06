import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { loginWithEmail, signupWithEmail, loginWithGoogle } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "مرحباً بك في منصة جدولة القصص",
        });
      } else {
        await signupWithEmail(email, password, displayName);
        toast({
          title: "تم إنشاء الحساب بنجاح",
          description: "مرحباً بك! يمكنك الآن البدء في جدولة القصص",
        });
      }
    } catch (error: any) {
      toast({
        title: "حدث خطأ",
        description: error.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك في منصة جدولة القصص",
      });
    } catch (error: any) {
      toast({
        title: "حدث خطأ",
        description: error.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <i className="fas fa-calendar-days text-2xl"></i>
            </div>
            <div>
              <h1 className="text-4xl font-bold">منصة جدولة القصص</h1>
              <p className="text-muted-foreground text-lg">جدولة ذكية للقصص على وسائل التواصل</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <i className="fas fa-calendar-check"></i>
              </div>
              <div>
                <h3 className="font-semibold">جدولة تلقائية</h3>
                <p className="text-sm text-muted-foreground">جدول قصصك على فيسبوك وانستجرام وتيك توك</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <i className="fas fa-wand-magic-sparkles"></i>
              </div>
              <div>
                <h3 className="font-semibold">مولد محتوى ذكي</h3>
                <p className="text-sm text-muted-foreground">استخدم الذكاء الاصطناعي لإنشاء محتوى جذاب</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <i className="fas fa-chart-line"></i>
              </div>
              <div>
                <h3 className="font-semibold">تحليلات شاملة</h3>
                <p className="text-sm text-muted-foreground">تابع أداء قصصك ومعدل التفاعل</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">
              {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "أدخل بياناتك للوصول إلى حسابك" : "املأ البيانات لإنشاء حساب جديد"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">
                    <i className="fas fa-user ml-2"></i>
                    الاسم الكامل
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    required={!isLogin}
                    data-testid="input-displayName"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">
                  <i className="fas fa-envelope ml-2"></i>
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  <i className="fas fa-lock ml-2"></i>
                  كلمة المرور
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? (
                  <i className="fas fa-spinner fa-spin ml-2"></i>
                ) : (
                  <i className={`fas ${isLogin ? "fa-right-to-bracket" : "fa-user-plus"} ml-2`}></i>
                )}
                {isLogin ? "تسجيل الدخول" : "إنشاء الحساب"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">أو</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              data-testid="button-google"
            >
              <i className="fab fa-google ml-2 text-destructive"></i>
              {isLogin ? "تسجيل الدخول" : "التسجيل"} باستخدام Google
            </Button>

            <div className="text-center text-sm">
              {isLogin ? (
                <span>
                  ليس لديك حساب؟{" "}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:underline"
                    onClick={() => setIsLogin(false)}
                    data-testid="button-toggle-signup"
                  >
                    إنشاء حساب جديد
                  </button>
                </span>
              ) : (
                <span>
                  لديك حساب بالفعل؟{" "}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:underline"
                    onClick={() => setIsLogin(true)}
                    data-testid="button-toggle-login"
                  >
                    تسجيل الدخول
                  </button>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
