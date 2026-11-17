import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDateTime, purposeLabels } from "@/lib/visits";
import { managerNavigation, representativeNavigation } from "@/lib/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Loader2,
  MapPin,
  MessageSquareText,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type PurposeFilter = "all" | keyof typeof purposeLabels;

function csvEscape(value: string | number | null | undefined): string {
  const str = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${str.replace(/"/g, '""')}"`;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRep, setNewRep] = useState({ openId: "", name: "", email: "", password: "" });
  const [reportToDelete, setReportToDelete] = useState<{ id: number; clientName: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const utils = trpc.useUtils();
  const { data: summary, isLoading: summaryLoading } = trpc.visits.managerSummary.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: reportsPage, isLoading, error } = trpc.visits.managerList.useQuery(
    {
      page,
      pageSize: 15,
      search: debouncedQuery || undefined,
      purpose: purposeFilter === "all" ? undefined : purposeFilter,
    },
    { enabled: user?.role === "admin" },
  );

  const createUserMutation = trpc.auth.createUser.useMutation({
    onSuccess: async createdUser => {
      toast.success(`تم إنشاء حساب المندوب (${createdUser.name}) بنجاح.`);
      setNewRep({ openId: "", name: "", email: "", password: "" });
      setCreateDialogOpen(false);
      await utils.auth.listStaffKPIs.invalidate();
    },
    onError: err => {
      toast.error(err.message || "تعذر إنشاء الحساب.");
    },
  });

  const deleteVisitMutation = trpc.visits.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف تقرير الزيارة بنجاح.");
      setReportToDelete(null);
      await Promise.all([utils.visits.managerList.invalidate(), utils.visits.managerSummary.invalidate()]);
    },
    onError: err => {
      toast.error(err.message || "تعذر حذف التقرير.");
    },
  });

  if (user && user.role !== "admin") {
    return (
      <DashboardLayout title="لوحة المدير" navigation={representativeNavigation}>
        <Card>
          <CardContent className="p-10 text-center">
            <h2 className="font-bold text-[#153D3A]">هذه الصفحة مخصصة للمدير</h2>
            <p className="mt-2 text-sm text-slate-500">لا تملك صلاحية الوصول إلى تقارير جميع المندوبين.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  function handleCreateRepSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newRep.openId.trim() || !newRep.name.trim() || !newRep.password) {
      toast.error("يرجى تعبئة كافة الحقول الإلزامية.");
      return;
    }
    if (newRep.password.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 خانات.");
      return;
    }
    createUserMutation.mutate({
      openId: newRep.openId,
      name: newRep.name,
      email: newRep.email.trim() ? newRep.email : null,
      password: newRep.password,
      role: "user",
    });
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const exported = await utils.visits.managerExport.fetch({
        search: debouncedQuery || undefined,
        purpose: purposeFilter === "all" ? undefined : purposeFilter,
      });
      const items = exported.items;
      if (!items.length) {
        toast.info("لا توجد تقارير مطابقة للتصدير.");
        return;
      }
      const header = [
        "رقم التقرير",
        "اسم العميل",
        "المندوب",
        "الغرض",
        "جهة الاتصال",
        "الدور الوظيفي",
        "الهاتف",
        "العنوان",
        "التاريخ والوقت",
        "عدد التعليقات",
        "التقرير",
      ];
      const rows = items.map(item =>
        [
          csvEscape(item.id),
          csvEscape(item.clientName),
          csvEscape(item.representativeName || "مندوب"),
          csvEscape(purposeLabels[item.visitPurpose]),
          csvEscape(item.employeeName),
          csvEscape(item.employeeRole),
          csvEscape(item.phone),
          csvEscape(item.address),
          csvEscape(formatDateTime(item.visitedAt)),
          csvEscape(item.comments.length),
          csvEscape(item.report),
        ].join(","),
      );
      const csvContent = "\uFEFF" + [header.map(csvEscape).join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `visits-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      if (exported.truncated) {
        toast.warning(`تم تصدير أول ${items.length} تقرير من أصل ${exported.total}. ضيّق التصفية لتصدير الباقي.`);
      } else {
        toast.success(`تم تصدير ${items.length} تقرير بنجاح.`);
      }
    } catch {
      toast.error("تعذر تصدير التقارير.");
    } finally {
      setExporting(false);
    }
  }

  const visible = reportsPage?.items ?? [];
  const totalPages = reportsPage?.totalPages ?? 1;

  return (
    <DashboardLayout title="لوحة المدير" subtitle="مراجعة الزيارات الميدانية والتعليقات" navigation={managerNavigation}>
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-[#DCE8E5]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-slate-500">إجمالي التقارير</p>
                <p className="mt-1 text-2xl font-black text-[#153D3A]">
                  {summaryLoading ? "—" : summary?.totalVisits ?? 0}
                </p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E5F3EF] text-[#24746B]">
                <ClipboardCheck className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#DCE8E5]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-slate-500">المندوبون النشطون</p>
                <p className="mt-1 text-2xl font-black text-[#153D3A]">
                  {summaryLoading ? "—" : summary?.activeReps ?? 0}
                </p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F4EFDD] text-[#8B6C1C]">
                <UsersRound className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
          <Card className="border-[#DCE8E5]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-slate-500">بتعليقات المدير</p>
                <p className="mt-1 text-2xl font-black text-[#153D3A]">
                  {summaryLoading ? "—" : summary?.commentedVisits ?? 0}
                </p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EDE9F8] text-[#6955A5]">
                <MessageSquareText className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#DCE8E5]">
          <CardContent className="p-4 md:p-5">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-extrabold text-[#153D3A]">أحدث التقارير</h2>
                <p className="mt-1 text-sm text-slate-500">اضغط على أي تقرير لمشاهدة التفاصيل وإضافة ملاحظة.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="ابحث بالعميل أو المندوب"
                    className="h-10 w-full rounded-xl border border-[#D8E5E2] bg-white pr-9 pl-3 text-sm outline-none focus:border-[#0D756B] focus:ring-2 focus:ring-[#BEE5DE]"
                  />
                </div>

                <Select
                  value={purposeFilter}
                  onValueChange={val => {
                    setPurposeFilter(val as PurposeFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-44">
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

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleExportCsv()}
                  disabled={exporting}
                  className="h-10 border-[#BFDAD5] text-[#0D625B] hover:bg-[#EDF7F5]"
                >
                  {exporting ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <Download className="ml-1.5 h-4 w-4" />}
                  تصدير CSV
                </Button>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-10 bg-[#0D625B] text-white hover:bg-[#094D48]">
                      <UserPlus className="ml-1.5 h-4 w-4" />
                      إضافة مندوب
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-right font-bold text-[#153D3A]">إضافة مندوب مبيعات جديد</DialogTitle>
                      <DialogDescription className="text-right text-slate-500">
                        أنشئ بيانات اعتماد للمندوب الميداني ليتمكن من تسجيل الدخول ورفع التقارير.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateRepSubmit} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="repName">اسم المندوب</Label>
                        <Input
                          id="repName"
                          value={newRep.name}
                          onChange={e => setNewRep({ ...newRep, name: e.target.value })}
                          placeholder="مثال: خالد محمد"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="repOpenId">اسم المستخدم (المعرف)</Label>
                        <Input
                          id="repOpenId"
                          value={newRep.openId}
                          onChange={e => setNewRep({ ...newRep, openId: e.target.value })}
                          placeholder="مثال: khaled"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="repEmail">البريد الإلكتروني (اختياري)</Label>
                        <Input
                          id="repEmail"
                          type="email"
                          value={newRep.email}
                          onChange={e => setNewRep({ ...newRep, email: e.target.value })}
                          placeholder="khaled@company.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="repPassword">كلمة المرور</Label>
                        <Input
                          id="repPassword"
                          type="password"
                          value={newRep.password}
                          onChange={e => setNewRep({ ...newRep, password: e.target.value })}
                          placeholder="8 خانات على الأقل"
                          minLength={6}
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button
                          type="submit"
                          disabled={createUserMutation.isPending}
                          className="bg-[#0D625B] hover:bg-[#094D48]"
                        >
                          {createUserMutation.isPending ? (
                            <>
                              <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                              جارٍ الإنشاء...
                            </>
                          ) : (
                            "حفظ الحساب"
                          )}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(row => (
                  <Skeleton key={row} className="h-25 rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <p className="py-10 text-center text-sm text-destructive">تعذر تحميل التقارير.</p>
            ) : !visible.length ? (
              <div className="grid min-h-55 place-items-center text-center">
                <div>
                  <Building2 className="mx-auto h-7 w-7 text-[#77A7A0]" />
                  <p className="mt-3 text-sm text-slate-500">لا توجد تقارير مطابقة.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#E5EFED]">
                  {visible.map(report => (
                    <div
                      key={report.id}
                      className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-[#F6FBFA]"
                    >
                      <Link href={`/manager/reports/${report.id}`} className="flex min-w-0 flex-1 items-center gap-4 py-2">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E5F3EF] text-sm font-black text-[#246E66]">
                          {report.clientName.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-[#153D3A] transition-colors group-hover:text-[#0D756B]">
                              {report.clientName}
                            </h3>
                            <Badge variant="secondary" className="bg-[#EDF5F3] text-[#39746C]">
                              {purposeLabels[report.visitPurpose]}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            بواسطة {report.representativeName || "مندوب"} · {formatDateTime(report.visitedAt)}
                          </p>
                        </div>
                        <div className="hidden items-center gap-1 text-xs text-slate-500 md:flex">
                          <MapPin className="h-3.5 w-3.5 text-[#65A198]" />
                          <span className="max-w-xs truncate">{report.address}</span>
                        </div>
                        {report.comments.length ? (
                          <span className="shrink-0 rounded-full bg-[#E7F3F0] px-2 py-1 text-xs font-bold text-[#287167]">
                            {report.comments.length}
                          </span>
                        ) : null}
                      </Link>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReportToDelete({ id: report.id, clientName: report.clientName });
                        }}
                        className="h-8 w-8 shrink-0 rounded-lg text-slate-400 opacity-60 transition hover:bg-red-50 hover:text-destructive hover:opacity-100 group-hover:opacity-100"
                        title="حذف التقرير"
                        aria-label={`حذف تقرير ${report.clientName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-between border-t border-[#E5EFED] pt-4 text-xs text-slate-600">
                    <span>
                      صفحة {page} من {totalPages} (إجمالي النتائج: {reportsPage?.total ?? 0})
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
          </CardContent>
        </Card>

        <AlertDialog open={!!reportToDelete} onOpenChange={open => !open && setReportToDelete(null)}>
          <AlertDialogContent dir="rtl" className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                <span>تأكيد حذف التقرير</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-slate-600">
                هل أنت متأكد من رغبتك في حذف تقرير الزيارة لعميل <strong>"{reportToDelete?.clientName}"</strong> نهائيًا؟
                <span className="mt-2.5 block rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-900">
                  ⚠️ تنبيه: سيتم حذف كافة بيانات التقرير وملاحظات الإدارة والصور المرفقة من السيرفر نهائيًا ولا يمكن التراجع عن هذا الإجراء.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse justify-start gap-2 pt-3">
              <AlertDialogCancel disabled={deleteVisitMutation.isPending}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={e => {
                  e.preventDefault();
                  if (reportToDelete) deleteVisitMutation.mutate({ id: reportToDelete.id });
                }}
                disabled={deleteVisitMutation.isPending}
                className="gap-1.5 bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteVisitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>حذف نهائي</span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </DashboardLayout>
  );
}
