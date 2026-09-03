import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { managerNavigation, representativeNavigation } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/visits";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Edit2,
  KeyRound,
  Loader2,
  Lock,
  Search,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import React, { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

export default function ManagerStaff() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);

  // Form States
  const [newRep, setNewRep] = useState({ openId: "", name: "", email: "", password: "", role: "user" as "user" | "admin" });
  const [editingStaff, setEditingStaff] = useState<{ id: number; name: string; email: string; isActive: boolean; role: "user" | "admin" } | null>(null);
  const [resettingUser, setResettingUser] = useState<{ id: number; name: string; openId: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: staffList, isLoading, refetch } = trpc.auth.listStaffKPIs.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const createUserMutation = trpc.auth.createUser.useMutation({
    onSuccess: createdUser => {
      toast.success(`تم إنشاء حساب (${createdUser.name}) بنجاح.`);
      setNewRep({ openId: "", name: "", email: "", password: "", role: "user" });
      setCreateDialogOpen(false);
      refetch();
    },
    onError: err => {
      toast.error(err.message || "تعذر إنشاء الحساب.");
    },
  });

  const updateUserMutation = trpc.auth.updateUser.useMutation({
    onSuccess: updatedUser => {
      toast.success(`تم تحديث بيانات (${updatedUser.name}) بنجاح.`);
      setEditDialogOpen(false);
      setEditingStaff(null);
      refetch();
    },
    onError: err => {
      toast.error(err.message || "تعذر تحديث البيانات.");
    },
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(`تم إعادة تعيين كلمة المرور بنجاح للمستخدم (${resettingUser?.name}).`);
      setResetPasswordDialogOpen(false);
      setResettingUser(null);
      setNewPassword("");
    },
    onError: err => {
      toast.error(err.message || "تعذر إعادة تعيين كلمة المرور.");
    },
  });

  if (user && user.role !== "admin") {
    return (
      <DashboardLayout title="لوحة المدير" navigation={representativeNavigation}>
        <Card>
          <CardContent className="p-10 text-center">
            <h2 className="font-bold text-[#153D3A]">هذه الصفحة مخصصة للمدير</h2>
            <p className="mt-2 text-sm text-slate-500">لا تملك صلاحية الوصول إلى إدارة الموظفين ومؤشرات الأداء.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Summary Metrics calculations
  const totalStaff = staffList?.length || 0;
  const activeStaff = staffList?.filter(s => s.isActive).length || 0;
  const totalMonthVisits = staffList?.reduce((acc, s) => acc + s.thisMonthVisits, 0) || 0;
  const avgVisitsPerRep = activeStaff > 0 ? (totalMonthVisits / activeStaff).toFixed(1) : "0";

  const topPerformer = useMemo(() => {
    if (!staffList || staffList.length === 0) return null;
    const reps = staffList.filter(s => s.role === "user");
    if (reps.length === 0) return null;
    return [...reps].sort((a, b) => b.thisMonthVisits - a.thisMonthVisits)[0];
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    return staffList.filter(s => {
      const matchesSearch =
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.openId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? s.isActive : !s.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [staffList, searchQuery, statusFilter]);

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newRep.openId.trim() || !newRep.name.trim() || !newRep.password) {
      toast.error("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }
    createUserMutation.mutate({
      openId: newRep.openId,
      name: newRep.name,
      email: newRep.email.trim() ? newRep.email : null,
      password: newRep.password,
      role: newRep.role,
    });
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingStaff) return;
    updateUserMutation.mutate({
      id: editingStaff.id,
      name: editingStaff.name,
      email: editingStaff.email.trim() ? editingStaff.email : null,
      isActive: editingStaff.isActive,
      role: editingStaff.role,
    });
  }

  function handleToggleStatus(staff: NonNullable<typeof staffList>[number]) {
    if (staff.id === user?.id && staff.isActive) {
      toast.error("لا يمكنك تجميد حسابك الحالي لتجنب إقفال النظام.");
      return;
    }
    const newStatus = !staff.isActive;
    updateUserMutation.mutate({
      id: staff.id,
      isActive: newStatus,
    });
  }

  function handleResetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب ألا تقل عن 6 خانات.");
      return;
    }
    resetPasswordMutation.mutate({
      userId: resettingUser.id,
      newPassword,
    });
  }

  return (
    <DashboardLayout
      title="فريق العمل والأداء"
      subtitle="متابعة مؤشرات أداء المندوبين الميدانيين وإدارة الحسابات"
      navigation={managerNavigation}
    >
      <div className="space-y-6">
        {/* KPI Header Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#DCE8E5] shadow-xs">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">إجمالي الفريق</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#153D3A]">{isLoading ? "—" : totalStaff}</span>
                  <span className="text-xs font-medium text-emerald-700">({activeStaff} نشط)</span>
                </div>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E5F3EF] text-[#24746B]">
                <Users className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          <Card className="border-[#DCE8E5] shadow-xs">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">زيارات هذا الشهر</p>
                <p className="mt-1 text-2xl font-black text-[#153D3A]">
                  {isLoading ? "—" : totalMonthVisits}
                </p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <CalendarCheck className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          <Card className="border-[#DCE8E5] shadow-xs">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">معدل الزيارات للمندوب</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#153D3A]">{isLoading ? "—" : avgVisitsPerRep}</span>
                  <span className="text-xs text-slate-500">زيارة / مندوب</span>
                </div>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-700">
                <TrendingUp className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          <Card className="border-[#DCE8E5] shadow-xs">
            <CardContent className="flex items-center justify-between p-4">
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-slate-500">الأكثر نشاطاً هذا الشهر</p>
                <p className="mt-1 truncate text-base font-bold text-[#153D3A]" title={topPerformer?.name || ""}>
                  {isLoading ? "—" : topPerformer ? topPerformer.name : "لا يوجد بعد"}
                </p>
                {topPerformer && (
                  <p className="text-xs text-emerald-700 font-medium">{topPerformer.thisMonthVisits} زيارة</p>
                )}
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F4EFDD] text-[#8B6C1C]">
                <Award className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        </section>

        {/* Action Controls & Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو اسم المستخدم أو البريد..."
                className="pr-9"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-[#DCE8E5] bg-white p-1">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === "all" ? "bg-[#24746B] text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                الكل ({staffList?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === "active" ? "bg-[#24746B] text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                النشطون ({staffList?.filter(s => s.isActive).length || 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("suspended")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === "suspended" ? "bg-[#24746B] text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                المجمدون ({staffList?.filter(s => !s.isActive).length || 0})
              </button>
            </div>
          </div>

          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-[#24746B] hover:bg-[#1B5750] text-white gap-2 shadow-xs"
          >
            <UserPlus className="h-4 w-4" />
            <span>إضافة مندوب جديد</span>
          </Button>
        </div>

        {/* Staff List Grid */}
        <section className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <Card className="border-dashed border-slate-300">
              <CardContent className="p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-3 text-base font-semibold text-slate-800">لا يوجد موظفون مطابقون</h3>
                <p className="mt-1 text-xs text-slate-500">جرب تغيير شروط البحث أو الفرز.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredStaff.map(staff => {
                const isCurrentUser = staff.id === user?.id;
                return (
                  <Card
                    key={staff.id}
                    className={`relative overflow-hidden border transition-all ${
                      staff.isActive
                        ? "border-[#DCE8E5] hover:border-[#24746B]/40 hover:shadow-sm"
                        : "border-slate-200 bg-slate-50/70 opacity-80"
                    }`}
                  >
                    <CardContent className="p-5">
                      {/* Top Row: User identity & Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold shadow-xs ${
                              staff.role === "admin"
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : staff.isActive
                                ? "bg-[#E5F3EF] text-[#24746B] border border-[#DCE8E5]"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {staff.name ? staff.name.charAt(0) : "م"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-bold text-[#153D3A] text-base" title={staff.name || ""}>
                                {staff.name}
                              </h3>
                              {isCurrentUser && (
                                <Badge variant="outline" className="text-[10px] text-[#24746B] border-[#24746B]/30">
                                  أنت
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-slate-500 font-mono" dir="ltr">
                              @{staff.openId}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            className={
                              staff.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }
                          >
                            {staff.isActive ? "نشط" : "مجمّد"}
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            {staff.role === "admin" ? "مدير النظام" : "مندوب مبيعات"}
                          </span>
                        </div>
                      </div>

                      {/* Middle: KPI stats box */}
                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center border border-slate-100">
                        <div>
                          <p className="text-[11px] text-slate-500 font-medium">هذا الشهر</p>
                          <p className="mt-0.5 text-lg font-black text-[#24746B]">{staff.thisMonthVisits}</p>
                        </div>
                        <div className="border-r border-slate-200">
                          <p className="text-[11px] text-slate-500 font-medium">آخر 7 أيام</p>
                          <p className="mt-0.5 text-lg font-black text-slate-800">{staff.last7DaysVisits}</p>
                        </div>
                        <div className="border-r border-slate-200">
                          <p className="text-[11px] text-slate-500 font-medium">الإجمالي</p>
                          <p className="mt-0.5 text-lg font-black text-slate-800">{staff.totalVisits}</p>
                        </div>
                      </div>

                      {/* Bottom Info: Last visit */}
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>آخر زيارة ميدانية:</span>
                        <span className="font-medium text-slate-700">
                          {staff.lastVisitAt ? formatDateTime(staff.lastVisitAt) : "لا توجد زيارات"}
                        </span>
                      </div>

                      {/* Action buttons footer */}
                      <div className="mt-4 flex items-center gap-1.5 pt-3 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingStaff({
                              id: staff.id,
                              name: staff.name || "",
                              email: staff.email || "",
                              isActive: staff.isActive,
                              role: staff.role,
                            });
                            setEditDialogOpen(true);
                          }}
                          className="flex-1 text-xs gap-1 h-8"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResettingUser({ id: staff.id, name: staff.name || "", openId: staff.openId });
                            setResetPasswordDialogOpen(true);
                          }}
                          className="flex-1 text-xs gap-1 h-8"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>كلمة المرور</span>
                        </Button>

                        {!isCurrentUser && (
                          <Button
                            size="sm"
                            variant={staff.isActive ? "ghost" : "default"}
                            onClick={() => handleToggleStatus(staff)}
                            disabled={updateUserMutation.isPending}
                            className={`text-xs h-8 px-2.5 ${
                              staff.isActive
                                ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                            title={staff.isActive ? "تجميد الحساب" : "تفعيل الحساب"}
                          >
                            {staff.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Dialog: Create New Representative */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مندوب جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات المندوب لإنشاء حسابه وإعطائه إمكانية تسجيل الدخول وإرسال الزيارات.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="openId">اسم المستخدم (المعرف للدخول) *</Label>
              <Input
                id="openId"
                value={newRep.openId}
                onChange={e => setNewRep(prev => ({ ...prev, openId: e.target.value }))}
                placeholder="مثال: ahmad_ali"
                dir="ltr"
                className="text-left font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">اسم الموظف الكامل *</Label>
              <Input
                id="name"
                value={newRep.name}
                onChange={e => setNewRep(prev => ({ ...prev, name: e.target.value }))}
                placeholder="مثال: أحمد علي"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
              <Input
                id="email"
                type="email"
                value={newRep.email}
                onChange={e => setNewRep(prev => ({ ...prev, email: e.target.value }))}
                placeholder="ahmad@company.com"
                dir="ltr"
                className="text-left font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور الأولية *</Label>
              <Input
                id="password"
                type="password"
                value={newRep.password}
                onChange={e => setNewRep(prev => ({ ...prev, password: e.target.value }))}
                placeholder="6 خانات على الأقل"
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createUserMutation.isPending}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                className="bg-[#24746B] hover:bg-[#1B5750] text-white"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إنشاء الحساب
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Staff Member */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
            <DialogDescription>
              تعديل الاسم والبريد الإلكتروني أو حالة الحساب.
            </DialogDescription>
          </DialogHeader>
          {editingStaff && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="editName">اسم الموظف الكامل *</Label>
                <Input
                  id="editName"
                  value={editingStaff.name}
                  onChange={e => setEditingStaff(prev => prev ? { ...prev, name: e.target.value } : null)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editEmail">البريد الإلكتروني</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editingStaff.email}
                  onChange={e => setEditingStaff(prev => prev ? { ...prev, email: e.target.value } : null)}
                  dir="ltr"
                  className="text-left font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>حالة الحساب</Label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editingStaff.isActive}
                      onChange={() => setEditingStaff(prev => prev ? { ...prev, isActive: true } : null)}
                      className="accent-[#24746B]"
                    />
                    <span>نشط (يمكنه الدخول وتسجيل الزيارات)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-rose-700">
                    <input
                      type="radio"
                      name="isActive"
                      checked={!editingStaff.isActive}
                      disabled={editingStaff.id === user?.id}
                      onChange={() => setEditingStaff(prev => prev ? { ...prev, isActive: false } : null)}
                      className="accent-rose-600"
                    />
                    <span>مجمّد</span>
                  </label>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={updateUserMutation.isPending}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-[#24746B] hover:bg-[#1B5750] text-white"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ التعديلات
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset Password */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين كلمة مرور جديدة</DialogTitle>
            <DialogDescription>
              تعيين كلمة مرور جديدة لـ <strong>{resettingUser?.name}</strong> (@{resettingUser?.openId}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">كلمة المرور الجديدة *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية (6 خانات على الأقل)"
                required
                minLength={6}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordDialogOpen(false)}
                disabled={resetPasswordMutation.isPending}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                className="bg-[#24746B] hover:bg-[#1B5750] text-white"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تأكيد التغيير
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
