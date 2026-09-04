import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download, PlusSquare, Share2, Smartphone, X } from "lucide-react";
import React, { useState } from "react";

export default function PwaInstallPrompt() {
  const { canInstall, isIos, isDismissed, triggerInstall, dismiss } = usePwaInstall();
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  // If already installed or dismissed, do not show
  if (!canInstall || isDismissed) {
    return null;
  }

  async function handleInstallClick() {
    const outcome = await triggerInstall();
    if (outcome === "ios_instructions") {
      setIosDialogOpen(true);
    }
  }

  return (
    <>
      {/* Floating Bottom PWA Install Banner */}
      <aside
        aria-label="تثبيت التطبيق"
        className="fixed bottom-4 right-4 left-4 z-50 mx-auto max-w-lg animate-in fade-in slide-in-from-bottom-5 duration-300"
      >
        <div className="relative flex flex-col gap-3 rounded-2xl border border-[#24746B]/30 bg-[#104946] p-4 text-white shadow-[0_20px_50px_-15px_rgba(16,73,70,0.7)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="absolute left-2.5 top-2.5 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="إغلاق التنبيه"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3.5 pl-6 sm:pl-0">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#D8FFB6] text-[#0B4C46] shadow-sm">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white">تثبيت التطبيق على الجوال</h3>
              <p className="mt-0.5 text-xs leading-5 text-white/75">
                وصول أسرع، شاشة كاملة، وسهولة التقاط الكاميرا وتحديد الموقع.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="text-xs text-white/75 hover:bg-white/10 hover:text-white"
            >
              لاحقاً
            </Button>
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="gap-1.5 bg-[#D8FFB6] text-[#0B4C46] hover:bg-[#c9f6a2] font-bold text-xs shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تثبيت الآن</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* iOS Step-by-Step Instructions Dialog */}
      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#153D3A]">
              <Smartphone className="h-5 w-5 text-[#24746B]" />
              <span>تثبيت التطبيق على أجهزة آيفون (iPhone)</span>
            </DialogTitle>
            <DialogDescription>
              اتبع الخطوات البسيطة التالية لإضافة التطبيق إلى شاشتك الرئيسية:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-slate-700">
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
                ١
              </span>
              <div>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  اضغط على زر المشاركة
                  <Share2 className="h-4 w-4 text-blue-600 inline" />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  موجود في شريط متصفح سفاري (Safari) أسفل الشاشة.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
                ٢
              </span>
              <div>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  اختر "إضافة إلى الصفحة الرئيسية"
                  <PlusSquare className="h-4 w-4 text-emerald-600 inline" />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  (Add to Home Screen) من قائمة الخيارات التي ستظهر.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-700 font-bold text-xs">
                ٣
              </span>
              <div>
                <p className="font-semibold text-slate-900">اضغط "إضافة" (Add) في الزاوية</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  ستجد أيقونة التطبيق ظهرت على شاشة هاتفك الرئيسية كأي تطبيق أصلي!
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full bg-[#24746B] hover:bg-[#1B5750] text-white"
              onClick={() => {
                setIosDialogOpen(false);
                dismiss();
              }}
            >
              فهمت، شكراً لك
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
