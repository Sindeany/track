import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Camera, Check, ImagePlus, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type CameraCaptureProps = {
  disabled?: boolean;
  onCapture: (photo: string) => void;
  photos?: string[];
  onRemove?: (index: number) => void;
  maximumPhotos?: number;
  triggerClassName?: string;
};

export function getCameraUnavailableMessage(mediaDevices?: Pick<MediaDevices, "getUserMedia"> | null) {
  return !mediaDevices || typeof mediaDevices.getUserMedia !== "function"
    ? "الكاميرا غير مدعومة في هذا المتصفح. افتح التطبيق من متصفح حديث على الهاتف."
    : null;
}

export function canCaptureMore(photoCount: number, maximumPhotos = 5) {
  return photoCount < maximumPhotos;
}

type CanvasForCapture = {
  width: number;
  height: number;
  getContext: (contextId: "2d") => CanvasRenderingContext2D | null;
  toDataURL: (type?: string, quality?: number) => string;
};

export const MAX_UPLOAD_IMAGE_SIDE = 1280;
export const COMPRESSED_JPEG_QUALITY = 0.7;

export function captureCameraFrame(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight">,
  createCanvas: () => CanvasForCapture = () => document.createElement("canvas"),
) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const longestSide = Math.max(video.videoWidth, video.videoHeight);
  const scale = Math.min(1, MAX_UPLOAD_IMAGE_SIDE / longestSide);
  const canvas = createCanvas();
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video as HTMLVideoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", COMPRESSED_JPEG_QUALITY);
}

export function getCompressedImageBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.max(0, Math.ceil((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0));
}

export function formatCompressedImageSize(dataUrl: string) {
  const bytes = getCompressedImageBytes(dataUrl);
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} م.ب` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
}

export function removeCapturedPhoto(photos: string[], index: number) {
  return photos.filter((_, photoIndex) => photoIndex !== index);
}

function getDevelopmentCameraMode() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has("camera-preview")) return "review" as const;
  if (params.has("camera-open")) return "capture" as const;
  return null;
}

function getDevelopmentCameraPreview(mode: "review" | "capture" | null) {
  if (mode !== "review") return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760"><rect width="600" height="760" fill="#DDF3EE"/><circle cx="300" cy="285" r="105" fill="#0D625B" opacity=".15"/><path d="M140 480l105-120 78 76 80-98 132 153v108H92V527l48-47z" fill="#0D625B" opacity=".82"/><text x="300" y="678" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="#0D625B">معاينة لقطة الكاميرا</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function CameraCapture({ disabled, onCapture, photos = [], onRemove, maximumPhotos = 5, triggerClassName }: CameraCaptureProps) {
  const developmentCameraMode = getDevelopmentCameraMode();
  const developmentPreviewPhoto = getDevelopmentCameraPreview(developmentCameraMode);
  const [open, setOpen] = useState(() => Boolean(developmentCameraMode));
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(() => developmentPreviewPhoto);
  const [compressing, setCompressing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    if (developmentCameraMode) return;
    let active = true;
    setStarting(true);
    setCameraError("");
    const unavailableMessage = getCameraUnavailableMessage(navigator.mediaDevices);
    if (unavailableMessage) {
      setCameraError(unavailableMessage);
      setStarting(false);
      return () => { active = false; };
    }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    }).then(stream => {
      if (!active) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
    }).catch(() => {
      if (active) setCameraError("تعذر تشغيل الكاميرا. تحقق من الإذن ثم حاول مجددًا.");
    }).finally(() => { if (active) setStarting(false); });
    return () => { active = false; stopCamera(); };
  }, [open]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return toast.error("الكاميرا ليست جاهزة بعد.");
    setCompressing(true);
    window.setTimeout(() => {
      const photo = captureCameraFrame(video);
      if (!photo) toast.error("الكاميرا ليست جاهزة بعد.");
      else setPendingPhoto(photo);
      setCompressing(false);
    }, 0);
  }

  function attachPendingPhoto() {
    if (!pendingPhoto) return;
    onCapture(pendingPhoto);
    setPendingPhoto(null);
    toast.success(`تمت إضافة الصورة ${photos.length + 1} للتقرير.`);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setPendingPhoto(null);
    setOpen(nextOpen);
  }

  const canCapture = canCaptureMore(photos.length, maximumPhotos);

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <Button type="button" onClick={() => setOpen(true)} disabled={disabled} className={cn("h-12 bg-[#0D625B] px-4 text-right shadow-[0_12px_28px_-14px_rgba(13,98,91,.65)] hover:bg-[#094D48]", triggerClassName)}><Camera className="ml-2 h-5 w-5 shrink-0" /><span className="flex flex-col items-start leading-tight"><span className="font-bold">التقاط وإرفاق صورة</span><span className="mt-0.5 text-[10px] font-normal text-white/70">كاميرا الجهاز فقط</span></span></Button>
    <DialogContent className="h-[100dvh] max-w-none gap-0 overflow-hidden border-0 bg-[#091F1D] p-0 text-white sm:h-auto sm:max-w-md sm:rounded-[2rem]" dir="rtl" onPointerDownOutside={event => { if (starting) event.preventDefault(); }}>
      <DialogHeader className="sr-only"><DialogTitle>كاميرا الزيارة</DialogTitle><DialogDescription>التقط الصورة ثم راجعها واحفظها.</DialogDescription></DialogHeader>
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black sm:min-h-[30rem]">
        {cameraError ? <div className="max-w-xs p-7 text-center"><Camera className="mx-auto h-10 w-10 text-[#D8FFB6]" /><p className="mt-4 text-sm leading-7 text-white/75">{cameraError}</p><Button type="button" onClick={() => handleOpenChange(false)} variant="outline" className="mt-5 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">إغلاق</Button></div> : <><video ref={videoRef} className={cn("h-full min-h-[46dvh] w-full object-cover sm:min-h-[30rem]", pendingPhoto && "opacity-0")} autoPlay muted playsInline />{pendingPhoto ? <div className="absolute inset-0 grid place-items-center bg-black"><img src={pendingPhoto} alt="معاينة الصورة الجديدة قبل الإرفاق" className="h-full max-h-[68dvh] w-full object-contain sm:max-h-[30rem]" /></div> : <div className="pointer-events-none absolute inset-5 rounded-[2rem] border border-white/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)]" />}</>}
        <button type="button" onClick={() => handleOpenChange(false)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60" aria-label="إغلاق الكاميرا"><X className="h-5 w-5" /></button>
        {pendingPhoto ? <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-6 pb-6 pt-16 text-center"><p className="text-lg font-extrabold">هل تريد إرفاق هذه الصورة؟</p></div> : <div className="absolute bottom-5 right-0 left-0 text-center"><span className="rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/85 backdrop-blur">وجّه الكاميرا ثم اضغط زر الالتقاط</span></div>}
        {starting || compressing ? <div className="absolute inset-0 grid place-items-center bg-[#091F1D]/75"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-[#D8FFB6]" /><p className="mt-3 text-sm font-bold">{compressing ? "جارٍ ضغط الصورة..." : "جارٍ تجهيز الكاميرا..."}</p></div></div> : null}
      </div>
      {!cameraError ? <footer className="shrink-0 bg-[#0B2926] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {pendingPhoto ? <div className="space-y-3"><div className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-xs"><span className="font-medium text-white/85">ضُغطت الصورة تلقائيًا لتوفير البيانات</span><span className="shrink-0 rounded-lg bg-[#D8FFB6] px-2 py-1 font-bold text-[#0B4C46]">{formatCompressedImageSize(pendingPhoto)}</span></div><div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" onClick={() => setPendingPhoto(null)} className="h-13 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><RotateCcw className="ml-2 h-5 w-5" />إعادة التقاط</Button><Button type="button" onClick={attachPendingPhoto} className="h-13 bg-[#D8FFB6] text-[#0B4C46] hover:bg-[#C8F2A7]"><Check className="ml-2 h-5 w-5" />إرفاق الصورة</Button></div></div> : <div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2"><div className="flex -space-x-2 space-x-reverse" aria-label="الصور المرفقة">{photos.slice(0, 3).map((photo, index) => <div key={photo} className="relative"><img src={photo} alt={`صورة مرفقة ${index + 1}`} className="h-9 w-9 rounded-full border-2 border-[#0B2926] object-cover" />{onRemove ? <button type="button" onClick={() => onRemove(index)} aria-label={`حذف الصورة ${index + 1}`} className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#FBE9E7] text-[#A33D32] shadow-sm"><X className="h-2.5 w-2.5" /></button> : null}</div>)}{photos.length ? <span className="grid h-9 min-w-9 place-items-center rounded-full bg-white/10 px-1 text-xs font-bold text-[#D8FFB6]">{photos.length}/{maximumPhotos}</span> : <ImagePlus className="h-5 w-5 text-white/55" />}</div><span className="text-xs text-white/65">{photos.length ? `${photos.length} / ${maximumPhotos} مرفقة` : "لم تُرفق صور بعد"}</span></div><button type="button" onClick={capturePhoto} disabled={starting || compressing || !canCapture} className="grid h-17 w-17 shrink-0 place-items-center rounded-full border-4 border-white/30 bg-[#D8FFB6] text-[#0B4C46] shadow-[0_0_0_6px_rgba(216,255,182,.16)] transition-transform active:scale-95 disabled:opacity-40" aria-label="التقاط صورة"><Camera className="h-7 w-7" /></button></div>}
      </footer> : null}
    </DialogContent>
  </Dialog>;
}
