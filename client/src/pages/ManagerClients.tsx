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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { managerNavigation, representativeNavigation } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { Building2, Edit2, Loader2, MapPin, Phone, Search, Trash2, UserRound } from "lucide-react";
import React, { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type EditableClient = {
  id: number;
  name: string;
  address: string;
  contactPerson: string;
  contactRole: string;
  phone: string;
};

export default function ManagerClients() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<EditableClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: clients, isLoading, error } = trpc.clients.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: async updated => {
      toast.success(`تم تحديث بيانات العميل (${updated.name}).`);
      setEditingClient(null);
      await utils.clients.list.invalidate();
    },
    onError: err => {
      toast.error(err.message || "تعذر تحديث بيانات العميل.");
    },
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف العميل من الدليل.");
      setClientToDelete(null);
      await utils.clients.list.invalidate();
    },
    onError: err => {
      toast.error(err.message || "تعذر حذف العميل.");
    },
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(client =>
      `${client.name} ${client.address} ${client.contactPerson || ""} ${client.phone}`
        .toLowerCase()
        .includes(q),
    );
  }, [clients, searchQuery]);

  if (user && user.role !== "admin") {
    return (
      <DashboardLayout title="دليل العملاء" navigation={representativeNavigation}>
        <Card>
          <CardContent className="p-10 text-center">
            <h2 className="font-bold text-[#153D3A]">هذه الصفحة مخصصة للمدير</h2>
            <p className="mt-2 text-sm text-slate-500">لا تملك صلاحية تعديل سجل العملاء الرئيسي.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editingClient) return;
    updateMutation.mutate({
      id: editingClient.id,
      name: editingClient.name,
      address: editingClient.address,
      contactPerson: editingClient.contactPerson.trim() ? editingClient.contactPerson : null,
      contactRole: editingClient.contactRole.trim() ? editingClient.contactRole : null,
      phone: editingClient.phone,
    });
  }

  return (
    <DashboardLayout
      title="دليل العملاء"
      subtitle="إدارة سجل العملاء المستخدم في التعبئة التلقائية لتقارير الزيارات"
      navigation={managerNavigation}
    >
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم العميل أو العنوان أو الهاتف..."
              className="pr-9"
            />
          </div>
          <div className="text-xs font-semibold text-slate-500">
            إجمالي العملاء المسجلين: <span className="font-bold text-[#153D3A]">{clients?.length ?? 0}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map(item => (
              <Skeleton key={item} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-destructive">
              تعذر تحميل دليل العملاء. حاول مرة أخرى.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-[#C6DCD8]">
            <CardContent className="p-10 text-center">
              <Building2 className="mx-auto h-10 w-10 text-[#5C968F]" />
              <h2 className="mt-4 font-bold text-[#153D3A]">
                {searchQuery ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء مسجلون بعد"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                يُضاف العملاء تلقائياً إلى الدليل عند إرسال تقارير الزيارات الميدانية.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map(client => (
              <Card key={client.id} className="border-[#DCE8E5] transition hover:border-[#9DC7C0]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 font-extrabold text-[#153D3A]">
                        <Building2 className="h-4 w-4 shrink-0 text-[#24746B]" />
                        <span className="truncate">{client.name}</span>
                      </h3>
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5C968F]" />
                        <span>{client.address}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#0D625B] hover:bg-[#E5F3EF]"
                        aria-label={`تعديل ${client.name}`}
                        onClick={() =>
                          setEditingClient({
                            id: client.id,
                            name: client.name,
                            address: client.address,
                            contactPerson: client.contactPerson ?? "",
                            contactRole: client.contactRole ?? "",
                            phone: client.phone,
                          })
                        }
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                        aria-label={`حذف ${client.name}`}
                        onClick={() => setClientToDelete({ id: client.id, name: client.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#EDF3F1] pt-3 text-xs text-slate-600">
                    {client.contactPerson ? (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-[#5C968F]" />
                        {client.contactPerson}
                        {client.contactRole ? ` (${client.contactRole})` : ""}
                      </span>
                    ) : null}
                    <a
                      href={`tel:${client.phone}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#0D756B]"
                      dir="ltr"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(editingClient)} onOpenChange={open => !open && setEditingClient(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات العميل</DialogTitle>
            <DialogDescription>تحديث البيانات المعتمدة للاقتراح التلقائي للمندوبين.</DialogDescription>
          </DialogHeader>
          {editingClient ? (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-client-name">اسم العميل</Label>
                <Input
                  id="edit-client-name"
                  value={editingClient.name}
                  onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-client-address">العنوان</Label>
                <Textarea
                  id="edit-client-address"
                  value={editingClient.address}
                  onChange={e => setEditingClient({ ...editingClient, address: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-client-contact">جهة الاتصال</Label>
                  <Input
                    id="edit-client-contact"
                    value={editingClient.contactPerson}
                    onChange={e => setEditingClient({ ...editingClient, contactPerson: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-client-role">المنصب / الدور</Label>
                  <Input
                    id="edit-client-role"
                    value={editingClient.contactRole}
                    onChange={e => setEditingClient({ ...editingClient, contactRole: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-client-phone">رقم الهاتف</Label>
                <Input
                  id="edit-client-phone"
                  dir="ltr"
                  value={editingClient.phone}
                  onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })}
                  required
                />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="bg-[#0D625B] hover:bg-[#094D48]">
                  {updateMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                  حفظ التغييرات
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(clientToDelete)} onOpenChange={open => !open && setClientToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العميل من الدليل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف «{clientToDelete?.name}» من دليل العملاء؟ لن تتأثر تقارير الزيارات السابقة المسجلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDelete && deleteMutation.mutate({ id: clientToDelete.id })}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
