import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ClipboardPenLine, MapPinned, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/reports");
  }, [user, setLocation]);

  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F7F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#104946] font-black text-[#D8FFB6] shadow-sm">
            زم
          </div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#104946] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#F4F7F7] text-right" dir="rtl">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-10 md:py-10">
        <header className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#104946] font-black text-[#D8FFB6]">زم</span><span><strong className="block text-sm text-[#153D3A]">زيارة ميدانية</strong><span className="text-xs text-slate-500">تقارير ميدانية موثوقة</span></span></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#25645E] shadow-sm">PWA</span></header>
        <main className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.15fr_.85fr]">
          <section className="order-2 lg:order-1"><p className="mb-5 inline-flex rounded-full bg-[#DDF2EB] px-3 py-1.5 text-xs font-bold text-[#146058]">مصمم للعمل خارج المكتب</p><h1 className="max-w-2xl text-4xl font-black leading-[1.25] tracking-tight text-[#153D3A] md:text-6xl">كل زيارة موثقة.<br /><span className="text-[#0D756B]">كل قرار أوضح.</span></h1><p className="mt-6 max-w-xl text-base leading-8 text-slate-600 md:text-lg">سجّل تقارير الزيارات من الميدان، وثّق الموقع والصور، وامنح الإدارة رؤية واضحة في اللحظة المناسبة.</p><Button onClick={() => startLogin()} size="lg" className="mt-8 h-13 rounded-xl bg-[#0D625B] px-7 text-base shadow-[0_16px_28px_-14px_rgba(13,98,91,.65)] hover:bg-[#094D48]">تسجيل الدخول للمتابعة</Button></section>
          <section className="order-1 rounded-[2rem] bg-[#104946] p-6 text-white shadow-[0_30px_70px_-35px_rgba(16,73,70,.7)] md:p-8 lg:order-2"><div className="rounded-[1.5rem] border border-white/10 bg-white/7 p-5"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D8FFB6] text-[#0B4C46]"><ClipboardPenLine /></span><h2 className="mt-6 text-xl font-bold">تقرير ميداني منظم</h2><p className="mt-2 text-sm leading-7 text-white/65">سير عمل سريع يلتقط التفاصيل الضرورية دون تعقيد.</p></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/8 p-4"><MapPinned className="h-5 w-5 text-[#D8FFB6]" /><p className="mt-6 text-sm font-bold">موقع موثّق</p><p className="mt-1 text-xs text-white/55">لحظة الإرسال</p></div><div className="rounded-2xl bg-white/8 p-4"><ShieldCheck className="h-5 w-5 text-[#D8FFB6]" /><p className="mt-6 text-sm font-bold">صلاحيات واضحة</p><p className="mt-1 text-xs text-white/55">مندوب ومدير</p></div></div></section>
        </main>
        <footer className="text-center text-xs text-slate-400">نظام تقارير الزيارات الميدانية</footer>
      </div>
    </div>
  );
}
