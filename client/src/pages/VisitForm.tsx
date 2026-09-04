import DashboardLayout from "@/components/DashboardLayout";
import CameraCapture from "@/components/CameraCapture";
import SubmissionSuccessDialog from "@/components/SubmissionSuccessDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatShortDate, purposeLabels } from "@/lib/visits";
import { representativeNavigation } from "@/lib/navigation";
import { Building2, CheckCircle2, Clock3, ImagePlus, Loader2, LocateFixed, MapPin, Sparkles, Trash2 } from "lucide-react";
import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PositionState = { latitude: number; longitude: number; accuracy: number } | null;
const initialForm = { clientName: "", employeeName: "", employeeRole: "", phone: "", address: "", visitPurpose: "quote" as keyof typeof purposeLabels, report: "" };

function getDevelopmentPreviewPhotos() {
  if (!import.meta.env.DEV) return [];
  const requestedCount = Number(new URLSearchParams(window.location.search).get("photo-preview"));
  const count = Number.isFinite(requestedCount) ? Math.min(Math.max(Math.floor(requestedCount), 0), 5) : 0;
  const colors = [["#DDF3EE", "#0D625B"], ["#E9E3FB", "#5B4A9E"], ["#FFF0CF", "#966413"], ["#DFF1E2", "#386D4A"], ["#FCE3E9", "#A74760"]];
  return Array.from({ length: count }, (_, index) => {
    const [background, foreground] = colors[index] ?? colors[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${background}"/><circle cx="200" cy="158" r="56" fill="${foreground}" opacity=".18"/><path d="M160 210l30-34 24 23 29-35 41 46v50H116v-28l44-22z" fill="${foreground}" opacity=".8"/><text x="200" y="328" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${foreground}">معاينة ${index + 1}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function getDevelopmentSuccessPreview() {
  if (!import.meta.env.DEV) return null;
  const previewId = Number(new URLSearchParams(window.location.search).get("success-preview"));
  return Number.isInteger(previewId) && previewId > 0 ? previewId : null;
}

function getDevicePosition() {
  return new Promise<PositionState>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("هذا الجهاز لا يدعم تحديد الموقع."));
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      error => reject(error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}

export default function VisitForm() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState(initialForm);
  const [position, setPosition] = useState<PositionState>(null);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<string[]>(getDevelopmentPreviewPhotos);
  const [submittedVisitId, setSubmittedVisitId] = useState<number | null>(getDevelopmentSuccessPreview);
  const [previewTime, setPreviewTime] = useState(() => new Date());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autofilledClient, setAutofilledClient] = useState<string | null>(null);

  const { data: clientSuggestions, isLoading: searchingClients } = trpc.clients.search.useQuery(
    { query: form.clientName },
    { enabled: form.clientName.trim().length >= 1 && showSuggestions }
  );

  const createVisit = trpc.visits.create.useMutation({
    onSuccess: result => { setSubmittedVisitId(result.id); },
    onError: error => toast.error(error.message || "تعذر إرسال التقرير."),
  });

  const locate = useCallback(async (silent = false) => {
    setLocating(true);
    try { const current = await getDevicePosition(); setPosition(current); if (!silent) toast.success("تم تحديث موقع الزيارة."); return current; }
    catch (error) { if (!silent) toast.error(error instanceof Error ? error.message : "تعذر التقاط الموقع. تحقق من صلاحية الموقع."); return null; }
    finally { setLocating(false); }
  }, []);

  useEffect(() => { void locate(true); }, [locate]);
  useEffect(() => { const timer = window.setInterval(() => setPreviewTime(new Date()), 30_000); return () => window.clearInterval(timer); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const currentPosition = await locate(true);
    if (!currentPosition) { toast.error("يجب السماح بالوصول للموقع عند إرسال التقرير."); return; }
    createVisit.mutate({ ...form, latitude: currentPosition.latitude, longitude: currentPosition.longitude, locationAccuracy: currentPosition.accuracy, photos });
  }

  function handleSelectClient(client: { name: string; address: string; contactPerson: string | null; contactRole: string | null; phone: string }) {
    setForm(prev => ({
      ...prev,
      clientName: client.name,
      address: client.address,
      employeeName: client.contactPerson || prev.employeeName,
      employeeRole: client.contactRole || prev.employeeRole,
      phone: client.phone || prev.phone,
    }));
    setAutofilledClient(client.name);
    setShowSuggestions(false);
    toast.success(`تم ملء بيانات (${client.name}) تلقائيًا من سجل العملاء.`);
  }

  const viewSubmittedReport = () => {
    if (submittedVisitId) setLocation(`/reports/${submittedVisitId}`);
  };

  return <DashboardLayout title="تقرير زيارة جديد" subtitle="أدخل تفاصيل الزيارة ثم أرسلها من موقعك" navigation={representativeNavigation}>
    <SubmissionSuccessDialog open={submittedVisitId !== null} reportId={submittedVisitId} onViewReport={viewSubmittedReport} />
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <Card className="overflow-hidden border-0 bg-[#104946] text-white shadow-[0_18px_45px_-28px_rgba(16,73,70,.6)]"><CardContent className="flex flex-col gap-4 p-5 md:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#D8FFB6]" /><h2 className="font-bold">بيانات ميدانية موثّقة</h2></div><p className="mt-2 text-sm leading-6 text-white/65">البيانات أدناه للعرض فقط؛ وتُثبّت قيمها النهائية من النظام لحظة الإرسال.</p></div><div className="flex items-center gap-2"><Badge className={position ? "border-0 bg-[#D8FFB6] text-[#0B4C46]" : "border-0 bg-white/15 text-white"}>{position ? <CheckCircle2 className="ml-1 h-3.5 w-3.5" /> : <LocateFixed className="ml-1 h-3.5 w-3.5" />}{position ? `دقة تقريبية ${Math.round(position.accuracy)} م` : "جارٍ التحقق من الموقع"}</Badge><Button type="button" variant="ghost" onClick={() => void locate()} disabled={locating} className="border border-white/15 text-white hover:bg-white/10 hover:text-white">{locating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <LocateFixed className="ml-2 h-4 w-4" />}تحديث</Button></div></div><div className="grid gap-3 md:grid-cols-3"><div className="space-y-1"><Label className="text-xs text-white/65">التاريخ النظامي</Label><Input readOnly value={formatShortDate(previewTime)} className="h-10 border-white/10 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-[#D8FFB6]" /></div><div className="space-y-1"><Label className="text-xs text-white/65">الوقت النظامي</Label><Input readOnly value={previewTime.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} className="h-10 border-white/10 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-[#D8FFB6]" /></div><div className="space-y-1"><Label className="text-xs text-white/65">الموقع الحالي</Label><Input readOnly value={position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : "بانتظار سماح الموقع"} className="h-10 border-white/10 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-[#D8FFB6]" /></div></div></CardContent></Card>
      <section className="grid gap-5 lg:grid-cols-2"><Card className="border-[#DCE8E5] shadow-sm"><CardContent className="space-y-5 p-5 md:p-6"><div><p className="text-xs font-bold tracking-[.13em] text-[#35766E]">١ — جهة الزيارة</p><h2 className="mt-1 text-lg font-extrabold text-[#153D3A]">بيانات العميل</h2></div>
      <div className="space-y-2 relative">
        <div className="flex items-center justify-between">
          <Label htmlFor="clientName">اسم العميل</Label>
          {autofilledClient && form.clientName === autofilledClient && (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1 font-normal">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              تم التعبئة من السجل
            </Badge>
          )}
        </div>
        <div className="relative">
          <Input
            id="clientName"
            value={form.clientName}
            onChange={e => {
              setForm({ ...form, clientName: e.target.value });
              setShowSuggestions(true);
              if (autofilledClient && e.target.value !== autofilledClient) {
                setAutofilledClient(null);
              }
            }}
            onFocus={() => {
              if (form.clientName.trim().length >= 1) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 250);
            }}
            placeholder="اسم الشركة أو العميل (ابحث لاقتراح عميل سابق)"
            autoComplete="off"
            required
          />
          {searchingClients && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>

        {/* Floating Autocomplete Dropdown */}
        {showSuggestions && clientSuggestions && clientSuggestions.length > 0 && (
          <div className="absolute z-50 right-0 left-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#DCE8E5] bg-white p-1.5 shadow-xl">
            <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-[#35766E] uppercase">
              عملاء سابقون مطابقون (اضغط للتعبئة التلقائية)
            </div>
            {clientSuggestions.map(client => (
              <button
                key={client.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  handleSelectClient(client);
                }}
                className="flex w-full flex-col items-start gap-1 rounded-lg p-2.5 text-right transition-colors hover:bg-[#E5F3EF] cursor-pointer text-slate-800"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-bold text-[#153D3A] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#24746B]" />
                    {client.name}
                  </span>
                  <span className="text-xs font-mono text-slate-500" dir="ltr">
                    {client.phone}
                  </span>
                </div>
                <div className="flex w-full items-center justify-between text-xs text-slate-500">
                  <span className="truncate max-w-[200px]" title={client.address}>
                    📍 {client.address}
                  </span>
                  {client.contactPerson && (
                    <span className="text-slate-600">
                      👤 {client.contactPerson} {client.contactRole ? `(${client.contactRole})` : ""}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2"><Label htmlFor="address">العنوان</Label><Textarea id="address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="المدينة، الحي، اسم الشارع أو وصف الموقع" className="min-h-25 resize-none" required /></div><div className="space-y-2"><Label htmlFor="purpose">الغرض من الزيارة</Label><Select value={form.visitPurpose} onValueChange={value => setForm({ ...form, visitPurpose: value as keyof typeof purposeLabels })}><SelectTrigger id="purpose"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(purposeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
        <Card className="border-[#DCE8E5] shadow-sm"><CardContent className="space-y-5 p-5 md:p-6"><div><p className="text-xs font-bold tracking-[.13em] text-[#35766E]">٢ — التواصل</p><h2 className="mt-1 text-lg font-extrabold text-[#153D3A]">بيانات الموظف</h2></div><div className="space-y-2"><Label htmlFor="employeeName">اسم الموظف</Label><Input id="employeeName" value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} placeholder="اسم جهة الاتصال" required /></div><div className="space-y-2"><Label htmlFor="employeeRole">دور الموظف</Label><Input id="employeeRole" value={form.employeeRole} onChange={e => setForm({ ...form, employeeRole: e.target.value })} placeholder="مثال: مدير المشتريات" required /></div><div className="space-y-2"><Label htmlFor="phone">رقم الهاتف</Label><Input id="phone" dir="ltr" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+966 5X XXX XXXX" required /></div></CardContent></Card></section>
      <Card className="border-[#DCE8E5] shadow-sm"><CardContent className="space-y-4 p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.13em] text-[#35766E]">٣ — ملخص الزيارة</p><h2 className="mt-1 text-lg font-extrabold text-[#153D3A]">تقرير الزيارة</h2></div><Clock3 className="h-5 w-5 text-[#78A7A0]" /></div><Textarea value={form.report} onChange={e => setForm({ ...form, report: e.target.value })} placeholder="اذكر ما تم خلال الزيارة، ملاحظات العميل، الخطوات التالية وأي تفاصيل مهمة..." className="min-h-45 resize-y leading-7" required /></CardContent></Card>
        <Card className="border-[#DCE8E5] shadow-sm"><CardContent className="p-5 md:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold tracking-[.13em] text-[#35766E]">٤ — توثيق بصري</p><h2 className="mt-1 text-lg font-extrabold text-[#153D3A]">صور الزيارة</h2><p className="mt-1 text-sm text-slate-500">عند الانتهاء من التقرير، التقط الصور ثم أكّد إرفاقها. حتى ٥ صور.</p></div><span className="inline-flex h-9 items-center self-start rounded-full bg-[#EDF7F5] px-3 text-xs font-bold text-[#17675F]">{photos.length}/٥ صور مرفقة</span></div>{photos.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{photos.map((photo, index) => <div key={photo} className="group relative overflow-hidden rounded-xl border border-[#DCE8E5] bg-[#F4F7F7]"><img src={photo} alt={`صورة الزيارة ${index + 1}`} className="aspect-square w-full object-cover" /><button type="button" onClick={() => setPhotos(current => current.filter((_, photoIndex) => photoIndex !== index))} className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-slate-950/70 text-white opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100" aria-label={`حذف الصورة ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button><span className="absolute bottom-1.5 right-1.5 rounded-md bg-slate-950/65 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span></div>)}</div> : <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-[#C6DCD8] bg-[#FAFCFC] py-8 text-center"><ImagePlus className="h-6 w-6 text-[#78A7A0]" /><p className="mt-2 text-sm text-slate-500">لا توجد صور مرفقة حتى الآن</p></div>}</CardContent></Card>
      <section className="rounded-2xl border border-[#DCE8E5] bg-[#F8FBFA] p-4" aria-label="إجراءات إنهاء التقرير"><div className="flex flex-col gap-1"><h2 className="font-extrabold text-[#153D3A]">إنهاء التقرير</h2><p className="text-sm text-slate-500">راجع البيانات والصور ثم أرسل التقرير.</p></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end"><CameraCapture disabled={photos.length >= 5} photos={photos} onCapture={photo => setPhotos(current => [...current, photo])} onRemove={index => setPhotos(current => current.filter((_, photoIndex) => photoIndex !== index))} triggerClassName="w-full sm:w-auto" /><Button type="submit" disabled={createVisit.isPending || locating} className="h-12 w-full bg-[#0D625B] px-7 text-base hover:bg-[#094D48] sm:w-auto">{createVisit.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}{createVisit.isPending ? "جارٍ إرسال التقرير" : "إرسال التقرير"}</Button></div></section>
    </form>
  </DashboardLayout>;
}
