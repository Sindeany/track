import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (user) {
      setLocation(user.role === "admin" ? "/manager" : "/reports");
    }
  }, [user, setLocation]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async result => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("field-visits-demo-role");
      }
      await utils.auth.me.invalidate();
      toast.success(`مرحبًا بك، ${result.user.name || result.user.openId}`);
      setLocation(result.user.role === "admin" ? "/manager" : "/reports");
    },
    onError: error => {
      toast.error(error.message || "فشل تسجيل الدخول. تحقق من صحة البيانات.");
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!login.trim() || !password) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }
    loginMutation.mutate({ login, password });
  }

  if (loading || user) {
    return <div className="min-h-screen bg-[#F4F7F7]" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7F7] p-4 md:p-8" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-90">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#104946] text-xl font-black text-[#D8FFB6] shadow-sm">
              زم
            </span>
            <div className="text-right">
              <span className="block text-base font-extrabold text-[#153D3A]">زيارة ميدانية</span>
              <span className="text-xs text-slate-500">نظام التقارير الميدانية</span>
            </div>
          </Link>
        </div>

        <Card className="overflow-hidden border-[#DCE8E5] shadow-[0_20px_50px_-25px_rgba(16,73,70,.25)]">
          <CardContent className="p-6 md:p-8">
            <div className="mb-6 space-y-1 text-center">
              <h1 className="text-2xl font-black text-[#153D3A]">تسجيل الدخول</h1>
              <p className="text-sm text-slate-500">أدخل بيانات حسابك للمتابعة إلى النظام</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">اسم المستخدم أو البريد الإلكتروني</Label>
                <div className="relative">
                  <UserRound className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="login"
                    type="text"
                    autoComplete="username"
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    placeholder="اسم المستخدم أو البريد"
                    className="h-11 pr-9 pl-3 text-right"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <LockKeyhole className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pr-9 pl-10 text-right"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="mt-2 h-12 w-full rounded-xl bg-[#0D625B] text-base font-bold shadow-[0_12px_24px_-12px_rgba(13,98,91,.6)] hover:bg-[#094D48]"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ التحقق...
                  </>
                ) : (
                  "دخول"
                )}
              </Button>
            </form>

            <div className="mt-6 border-t border-[#EDF3F1] pt-4 text-center">
              <p className="flex items-center justify-center gap-1 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0D625B]" />
                اتصال مشفر وجلسة آمنة على مستوى الخادم
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          نظام تقارير الزيارات الميدانية — بيئة إنتاجية
        </p>
      </div>
    </div>
  );
}
