import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export interface LightboxPhoto {
  id?: number | string;
  url: string;
  title?: string;
}

export interface PhotoLightboxProps {
  photos: Array<LightboxPhoto | string>;
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

const HISTORY_STATE_KEY = "sales-visits-photo-lightbox";

export default function PhotoLightbox({
  photos,
  initialIndex = 0,
  isOpen,
  onClose,
}: PhotoLightboxProps) {
  // Normalize photos into consistent structure
  const normalizedPhotos = useMemo<LightboxPhoto[]>(() => {
    return photos.map((p, idx) => {
      if (typeof p === "string") {
        return { id: idx, url: p };
      }
      return {
        id: p.id ?? idx,
        url: p.url,
        title: p.title,
      };
    });
  }, [photos]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isPoppingRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Sync currentIndex when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.max(
        0,
        Math.min(initialIndex, normalizedPhotos.length - 1),
      );
      setCurrentIndex(validIndex);
      setIsZoomed(false);
      setImageLoaded(false);
    }
  }, [isOpen, initialIndex, normalizedPhotos.length]);

  // Reset zoom on image change
  useEffect(() => {
    setIsZoomed(false);
    setImageLoaded(false);
  }, [currentIndex]);

  // Mobile Back button handling via history.pushState and popstate
  useEffect(() => {
    if (!isOpen) return;

    // Push history state if not already present
    const currentState = window.history.state;
    if (!currentState?.[HISTORY_STATE_KEY]) {
      window.history.pushState(
        { ...(currentState || {}), [HISTORY_STATE_KEY]: true },
        "",
      );
    }

    const handlePopState = () => {
      // If closing was initiated by UI (which called history.back()), skip calling onClose again
      if (isPoppingRef.current) {
        isPoppingRef.current = false;
        return;
      }
      // User pressed the mobile device's back button / gesture!
      onClose();
    };

    window.addEventListener("popstate", handlePopState);

    // Prevent body background scroll while lightbox is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Safe close handler that pops history entry cleanly if present
  const handleClose = useCallback(() => {
    if (window.history.state?.[HISTORY_STATE_KEY]) {
      isPoppingRef.current = true;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  const total = normalizedPhotos.length;
  const currentPhoto = normalizedPhotos[currentIndex];

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((curr) => (curr + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((curr) => (curr - 1 + total) % total);
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowLeft") {
        // In RTL, left arrow usually moves forward or backward depending on convention
        goNext();
      } else if (e.key === "ArrowRight") {
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, goNext, goPrev]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Minimum swipe threshold of 45px and predominantly horizontal
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        // Swiped left -> advance to next
        goNext();
      } else {
        // Swiped right -> go to previous
        goPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Download photo action
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPhoto?.url) return;
    try {
      const response = await fetch(currentPhoto.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `visit-photo-${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("تم تنزيل الصورة بنجاح.");
    } catch {
      window.open(currentPhoto.url, "_blank");
    }
  };

  if (!isOpen || total === 0 || !currentPhoto) {
    return null;
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="استعراض صورة التقرير"
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-black/95 text-white backdrop-blur-md transition-all duration-300 animate-in fade-in"
      onClick={handleClose}
    >
      {/* Top Header Controls Bar */}
      <header
        className="z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3 sm:px-6 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Counter and Title */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#D8FFB6]">
            {total > 1 ? `صورة ${currentIndex + 1} من ${total}` : "صورة الزيارة"}
          </div>
          {currentPhoto.title ? (
            <span className="hidden text-xs text-white/70 sm:inline">
              {currentPhoto.title}
            </span>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Zoom Toggle */}
          <button
            type="button"
            onClick={() => setIsZoomed((z) => !z)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
            title={isZoomed ? "تصغير الصورة" : "تكبير الصورة"}
            aria-label={isZoomed ? "تصغير الصورة" : "تكبير الصورة"}
          >
            {isZoomed ? (
              <ZoomOut className="h-4 w-4" />
            ) : (
              <ZoomIn className="h-4 w-4" />
            )}
          </button>

          {/* Download Photo */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
            title="تنزيل الصورة"
            aria-label="تنزيل الصورة"
          >
            <Download className="h-4 w-4" />
          </button>

          {/* Open Original in new tab */}
          <a
            href={currentPhoto.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
            title="فتح الرابط المباشر في علامة تبويب جديدة"
            aria-label="فتح الرابط المباشر"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Prominent Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="mr-1 flex h-9 items-center gap-1 rounded-full bg-[#D8FFB6] px-3.5 text-xs font-extrabold text-[#0B4C46] transition hover:bg-[#C8F2A7] active:scale-95 shadow-sm"
            aria-label="إغلاق معاينة الصورة"
          >
            <X className="h-4 w-4" />
            <span>إغلاق</span>
          </button>
        </div>
      </header>

      {/* Main Image View Area */}
      <main
        className="relative flex flex-1 items-center justify-center overflow-auto p-2 sm:p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrow: Previous (RTL right button) */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute right-3 sm:right-6 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/80 hover:scale-105 active:scale-95 border border-white/15"
            aria-label="الصورة السابقة"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* The Photo */}
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            key={currentPhoto.url}
            src={currentPhoto.url}
            alt={currentPhoto.title || `صورة الزيارة ${currentIndex + 1}`}
            onLoad={() => setImageLoaded(true)}
            onClick={() => setIsZoomed((z) => !z)}
            className={cn(
              "max-h-[75vh] max-w-[95vw] rounded-xl object-contain shadow-2xl transition-all duration-300 select-none",
              isZoomed
                ? "scale-150 cursor-zoom-out sm:max-h-[90vh]"
                : "cursor-zoom-in",
              !imageLoaded && "opacity-60 blur-sm",
            )}
          />
        </div>

        {/* Navigation Arrow: Next (RTL left button) */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute left-3 sm:left-6 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/80 hover:scale-105 active:scale-95 border border-white/15"
            aria-label="الصورة التالية"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
      </main>

      {/* Bottom Thumbnails Strip / Swipe Helper */}
      <footer
        className="z-10 border-t border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 ? (
          <div className="mx-auto flex max-w-lg items-center justify-center gap-2 overflow-x-auto py-1">
            {normalizedPhotos.map((photo, idx) => (
              <button
                key={photo.id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "relative h-13 w-13 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200",
                  idx === currentIndex
                    ? "border-[#D8FFB6] ring-2 ring-[#D8FFB6]/50 scale-105 opacity-100 shadow-md"
                    : "border-white/20 opacity-50 hover:opacity-90",
                )}
                aria-label={`الانتقال إلى الصورة ${idx + 1}`}
              >
                <img
                  src={photo.url}
                  alt={`معاينة مصغرة ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-[11px] text-white/50">
            انقر على الصورة للتكبير • زر العودة بالجوال يغلق المعاينة بأمان
          </div>
        )}
      </footer>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
