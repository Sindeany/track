import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { representativeNavigation } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { listPendingVisits, removePendingVisit, type PendingVisitRecord } from "@/lib/visitOfflineQueue";
import { formatDateTime, purposeLabels } from "@/lib/visits";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudOff,
  Loader2,
  MapPin,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type PurposeFilter = "all" | keyof typeof purposeLabels;

export default function ReportsHistory() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("all");
  const [page, setPage] = useState(1);
  const [pendingVisits, setPendingVisits] = useState<PendingVisitRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const utils = trpc.useUtils();
  const createVisit = trpc.visits.create.useMutation();

  const refreshPending = useCallback(async () => {
    const items = await listPendingVisits();
    setPendingVisits(items);
  }, []);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: reportsPage, isLoading, error } = trpc.visits.mine.useQuery({
    page,
    pageSize: 15,
    search: debouncedQuery || undefined,
    purpose: purposeFilter === "all" ? undefined : purposeFilter,
  });

  const syncPendingVisits = useCallback(async () => {
    if (syncing || !pendingVisits.length) return;
    setSyncing(true);
    let syncedCount = 0;
    try {
      for (const item of pendingVisits) {
        try {
          await createVisit.mutateAsync(item.payload);
          await removePendingVisit(item.id);
          syncedCount += 1;
        } catch {
          // Stop on first network error so remaining items stay safely queued
          break;
        }
      }
      if (syncedCount > 0) {
        toast.success(`تمت مزامنة ${syncedCount} تقرير بنجاح.`);
        await utils.visits.mine.invalidate();
        await refreshPending();
      } else {
        toast.error("لا يزال الاتصال غير مستقر لمزامنة التقارير المعلقة.");
      }
    } finally {
      setSyncing(false);
    }
  }, [createVisit, pendingVisits, refreshPending, syncing, utils.visits.mine]);

  useEffect(() => {
    const onOnline = () => {
      if (pendingVisits.length > 0) {
        void syncPendingVisits();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [pendingVisits.length, syncPendingVisits]);

  const visible = reportsPage?.items ?? [];
  const totalPages = reportsPage?.totalPages ?? 1;

  return (
    <DashboardLayout title="تقاريري" subtitle="سجل زياراتك الميدانية وملاحظات المدير" navigation={representativeNavigation}>
      <section className="space-y-5">
        {pendingVisits.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
                    <CloudOff className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-amber-950">
                      توجد {pendingVisits.length} تقارير محفوظة بانتظار المزامنة
                    </h2>
                    <p className="mt-0.5 text-xs text-amber-800">
                      حُفظت هذه التقارير محلياً على جهازك أثناء ضعف الشبكة ولن تضيع.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={syncing}
                  onClick={() => void syncPendingVisits()}
                  className="bg-amber-900 text-white hover:bg-amber-950"
                >
                  {syncing ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-1.5 h-4 w-4" />}
                  مزامنة الآن
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {pendingVisits.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-xs"
                  >
                    <div>
                      <strong className="text-[#153D3A]">{item.payload.clientName}</strong>
                      <span className="mr-2 text-slate-500">· حُفظت {formatDateTime(new Date(item.queuedAt))}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await removePendingVisit(item.id);
                        await refreshPending();
                      }}
                      className="text-slate-400 hover:text-destructive"
                      aria-label={`حذف المسودة المعلقة ${item.payload.clientName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث باسم العميل أو العنوان"
                className="h-10 w-full rounded-xl border border-[#D8E5E2] bg-white pr-9 pl-3 text-sm outline-none transition focus:border-[#0D756B] focus:ring-2 focus:ring-[#BEE5DE]"
              />
            </div>
            <Select
              value={purposeFilter}
              onValueChange={val => {
                setPurposeFilter(val as PurposeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full bg-white sm:w-44">
                <SelectValue placeholder="كل الأغراض" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأغراض</SelectItem>
                {Object.entries(purposeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setLocation("/reports/new")} className="bg-[#0D625B] hover:bg-[#094D48]">
            <Plus className="ml-2 h-4 w-4" />
            تقرير زيارة جديد
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(item => (
              <Skeleton key={item} className="h-35 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-destructive">تعذر تحميل التقارير. حاول مرة أخرى.</CardContent>
          </Card>
        ) : !visible.length ? (
          <Card className="border-dashed border-[#C6DCD8]">
            <CardContent className="grid min-h-70 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E6F3F0] text-[#257069]">
                  <ClipboardList />
                </span>
                <h2 className="mt-4 font-bold text-[#153D3A]">
                  {debouncedQuery || purposeFilter !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد تقارير بعد"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {debouncedQuery || purposeFilter !== "all"
                    ? "غيّر كلمات البحث أو الفلتر."
                    : "ابدأ بإرسال تقرير الزيارة الأول من الميدان."}
                </p>
                {!debouncedQuery && purposeFilter === "all" && (
                  <Button onClick={() => setLocation("/reports/new")} className="mt-5 bg-[#0D625B] hover:bg-[#094D48]">
                    إنشاء تقرير
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {visible.map(report => (
                <Link key={report.id} href={`/reports/${report.id}`} className="block">
                  <Card className="border-[#DCE8E5] transition duration-200 hover:-translate-y-0.5 hover:border-[#9DC7C0] hover:shadow-md">
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate font-extrabold text-[#153D3A]">{report.clientName}</h2>
                            <Badge variant="secondary" className="bg-[#E7F3F0] text-[#1F6A62]">
                              {purposeLabels[report.visitPurpose]}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {report.employeeName} <span className="text-slate-400">—</span> {report.employeeRole}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">#{report.id}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                        <span className="inline-flex items-center">
                          <CalendarDays className="ml-1.5 h-3.5 w-3.5 text-[#5C968F]" />
                          {formatDateTime(report.visitedAt)}
                        </span>
                        <span className="inline-flex items-center">
                          <MapPin className="ml-1.5 h-3.5 w-3.5 text-[#5C968F]" />
                          {report.address}
                        </span>
                        {report.comments.length ? (
                          <span className="inline-flex items-center font-medium text-[#0D756B]">
                            <MessageSquareText className="ml-1.5 h-3.5 w-3.5" />
                            {report.comments.length} ملاحظة
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
                <span>
                  صفحة {page} من {totalPages} (الإجمالي: {reportsPage?.total ?? 0})
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronRight className="ml-1 h-4 w-4" />
                    السابق
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    التالي
                    <ChevronLeft className="mr-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </DashboardLayout>
  );
}
