import { safeStorage } from "@/lib/safeStorage";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(inStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIosDevice =
      (/iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(isIosDevice);

    // Check dismissal in safeStorage
    const dismissedAt = safeStorage.getItem("pwa_install_dismissed_at");
    if (dismissedAt) {
      const elapsedDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (elapsedDays < 5) {
        setIsDismissed(true);
      }
    }

    // Capture beforeinstallprompt for Android & Desktop
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<"accepted" | "dismissed" | "ios_instructions"> => {
    if (isIos) {
      return "ios_instructions";
    }

    if (!deferredPrompt) {
      return "dismissed";
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return choice.outcome;
  };

  const dismiss = () => {
    safeStorage.setItem("pwa_install_dismissed_at", Date.now().toString());
    setIsDismissed(true);
  };

  return {
    canInstall: !isInstalled && (Boolean(deferredPrompt) || isIos),
    isInstalled,
    isIos,
    isDismissed,
    triggerInstall,
    dismiss,
  };
}
