import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, FileText } from "lucide-react";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

type SubmissionSuccessDialogProps = {
  open: boolean;
  reportId: number | null;
  onViewReport: () => void;
};

export default function SubmissionSuccessDialog({ open, reportId, onViewReport }: SubmissionSuccessDialogProps) {
  const reduceMotion = useReducedMotion();

  return <Dialog open={open}>
    <DialogContent className="overflow-hidden border-0 bg-[#F8FCFB] p-0 text-center sm:max-w-md sm:rounded-[2rem]" dir="rtl" onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
      <DialogHeader className="sr-only"><DialogTitle>تم إرسال التقرير بنجاح</DialogTitle><DialogDescription>تم حفظ تقرير الزيارة ويمكنك مشاهدته الآن.</DialogDescription></DialogHeader>
      <div className="relative overflow-hidden px-6 pb-7 pt-9">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_#D8FFB6_0%,_#EAF7F1_40%,_transparent_72%)]" />
        <motion.div initial={reduceMotion ? false : { opacity: 0, scale: 0.78, rotate: -14 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 330, damping: 19 }} className="relative mx-auto grid h-24 w-24 place-items-center rounded-[2rem] bg-[#0D625B] shadow-[0_18px_38px_-16px_rgba(13,98,91,.55)]">
          <motion.div initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 0.16, duration: 0.24 }}><CheckCircle2 className="h-12 w-12 text-[#D8FFB6]" strokeWidth={2.4} /></motion.div>
        </motion.div>
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.2, duration: 0.22 }} className="relative">
          <span className="mt-6 inline-flex rounded-full bg-[#DFF3E9] px-3 py-1 text-xs font-bold text-[#186956]">اكتملت العملية</span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#153D3A]">تم إرسال تقرير الزيارة</h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-slate-500">تم حفظ تقريرك وبيانات الموقع والصور المرفقة بنجاح. سيظهر التقرير الآن في سجلك.</p>
          {reportId ? <p className="mt-3 text-xs font-semibold text-[#35766E]">رقم التقرير #{reportId}</p> : null}
          <Button type="button" onClick={onViewReport} className="mt-6 h-12 w-full bg-[#0D625B] text-base hover:bg-[#094D48]"><FileText className="ml-2 h-4 w-4" />عرض التقرير</Button>
        </motion.div>
      </div>
    </DialogContent>
  </Dialog>;
}
