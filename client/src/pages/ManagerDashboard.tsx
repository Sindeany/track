import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDateTime, purposeLabels } from "@/lib/visits";
import { managerNavigation, representativeNavigation } from "@/lib/navigation";
import { Building2, ClipboardCheck, Loader2, MapPin, MessageSquareText, Search, UserPlus, UsersRound } from "lucide-react";
import React, { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRep, setNewRep] = useState({ openId: "", name: "", email: "", password: "" });

  const { data: reports, isLoading, error } = trpc.visits.managerList.useQuery(undefined, { enabled: user?.role === "admin" });
  const createUserMutation = trpc.auth.createUser.useMutation({
    onSuccess: createdUser => {
      toast.success(`تم إنشاء حساب المندوب (${createdUser.name}) بنجاح.`);
      setNewRep({ openId: "", name: "", email: "", password: "" });
      setCreateDialogOpen(false);
    },
    onError: err => {
      toast.error(err.message || "تعذر إنشاء الحساب.");
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
    createUserMutation.mutate({
      openId: newRep.openId,
      name: newRep.name,
      email: newRep.email.trim() ? newRep.email : null,
      password: newRep.password,
      role: "user",
    });
  }

  const visible = reports?.filter(item => `${item.clientName} ${item.representativeName || ""} ${item.address}`.includes(query)) ?? [];
  const uniqueReps = new Set(reports?.map(item => item.representativeId) ?? []).size;

  return (
    <DashboardLayout title="لوحة المدير" subtitle="مراجعة الزيارات الميدانية والتعليقات" navigation={managerNavigation}>
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-[#DCE8E5]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-slate-500">إجمالي التقارير</p>
                <p className="mt-1 text-2xl font-black text-[#153D3A]">{isLoading ? "—" : reports?.length || 0}</p>
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
                <p className="mt-1 text-2xl font-black text-[#153D3A]">{isLoading ? "—" : uniqueReps}</p>
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
                  {isLoading ? "—" : reports?.filter(item => item.comments.length > 0).length || 0}
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
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-extrabold text-[#153D3A]">أحدث التقارير</h2>
                <p className="mt-1 text-sm text-slate-500">اضغط على أي تقرير لمشاهدة التفاصيل وإضافة ملاحظة.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="ابحث في التقارير"
                    className="h-10 w-full rounded-xl border border-[#D8E5E2] bg-white pr-9 pl-3 text-sm outline-none focus:border-[#0D756B] focus:ring-2 focus:ring-[#BEE5DE]"
                  />
                </div>

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
                          placeholder="٦ خانات على الأقل"
                          minLength={6}
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateDialogOpen(false)}
                        >
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
              <div className="divide-y divide-[#E5EFED]">
                {visible.map(report => (
                  <Link key={report.id} href={`/manager/reports/${report.id}`} className="block">
                    <div className="flex items-center gap-4 py-4 transition hover:bg-[#F6FBFA]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E5F3EF] text-sm font-black text-[#246E66]">
                        {report.clientName.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold text-[#153D3A]">{report.clientName}</h3>
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
                        {report.address}
                      </div>
                      {report.comments.length ? (
                        <span className="shrink-0 rounded-full bg-[#E7F3F0] px-2 py-1 text-xs font-bold text-[#287167]">
                          {report.comments.length}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardLayout>
  );
}
