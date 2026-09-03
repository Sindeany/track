import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDateTime, purposeLabels } from "@/lib/visits";
import { representativeNavigation } from "@/lib/navigation";
import { CalendarDays, ClipboardList, MapPin, MessageSquareText, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function ReportsHistory() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const { data: reports, isLoading, error } = trpc.visits.mine.useQuery();
  const visible = reports?.filter(report => `${report.clientName} ${report.employeeName} ${report.address}`.includes(query)) ?? [];
  return <DashboardLayout title="تقاريري" subtitle="سجل زياراتك الميدانية وملاحظات المدير" navigation={representativeNavigation}>
    <section className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-sm flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث باسم العميل أو العنوان" className="h-10 w-full rounded-xl border border-[#D8E5E2] bg-white pr-9 pl-3 text-sm outline-none transition focus:border-[#0D756B] focus:ring-2 focus:ring-[#BEE5DE]" /></div><Button onClick={() => setLocation("/reports/new")} className="bg-[#0D625B] hover:bg-[#094D48]"><Plus className="ml-2 h-4 w-4" />تقرير زيارة جديد</Button></div>
      {isLoading ? <div className="space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-35 rounded-2xl" />)}</div> : error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">تعذر تحميل التقارير. حاول مرة أخرى.</CardContent></Card> : !visible.length ? <Card className="border-dashed border-[#C6DCD8]"><CardContent className="grid min-h-70 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E6F3F0] text-[#257069]"><ClipboardList /></span><h2 className="mt-4 font-bold text-[#153D3A]">{query ? "لا توجد نتائج مطابقة" : "لا توجد تقارير بعد"}</h2><p className="mt-2 text-sm text-slate-500">{query ? "غيّر كلمات البحث أو امسحها." : "ابدأ بإرسال تقرير الزيارة الأول من الميدان."}</p>{!query && <Button onClick={() => setLocation("/reports/new")} className="mt-5 bg-[#0D625B] hover:bg-[#094D48]">إنشاء تقرير</Button>}</div></CardContent></Card> : <div className="grid gap-3">{visible.map(report => <Link key={report.id} href={`/reports/${report.id}`} className="block"><Card className="border-[#DCE8E5] transition duration-200 hover:-translate-y-0.5 hover:border-[#9DC7C0] hover:shadow-md"><CardContent className="p-4 md:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-extrabold text-[#153D3A]">{report.clientName}</h2><Badge variant="secondary" className="bg-[#E7F3F0] text-[#1F6A62]">{purposeLabels[report.visitPurpose]}</Badge></div><p className="mt-2 text-sm text-slate-600">{report.employeeName} <span className="text-slate-400">—</span> {report.employeeRole}</p></div><span className="shrink-0 text-xs text-slate-400">#{report.id}</span></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center"><CalendarDays className="ml-1.5 h-3.5 w-3.5 text-[#5C968F]" />{formatDateTime(report.visitedAt)}</span><span className="inline-flex items-center"><MapPin className="ml-1.5 h-3.5 w-3.5 text-[#5C968F]" />{report.address}</span>{report.comments.length ? <span className="inline-flex items-center font-medium text-[#0D756B]"><MessageSquareText className="ml-1.5 h-3.5 w-3.5" />{report.comments.length} ملاحظة</span> : null}</div></CardContent></Card></Link>)}</div>}</section>
  </DashboardLayout>;
}
