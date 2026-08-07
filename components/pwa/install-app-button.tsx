"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // iOS Safari when launched from Home Screen
  const safariNav = window.navigator as Navigator & { standalone?: boolean };
  return safariNav.standalone === true;
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  const ipadOs =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;

  return classicIos || ipadOs;
}

async function hasInstalledRelatedApps(): Promise<boolean> {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  };

  if (typeof nav.getInstalledRelatedApps !== "function") {
    return false;
  }

  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

export function InstallAppButton() {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsIos(isIosDevice());

    async function detectInstalled() {
      if (isStandaloneDisplay()) {
        if (!cancelled) {
          setInstalled(true);
        }
        return;
      }

      if (await hasInstalledRelatedApps()) {
        if (!cancelled) {
          setInstalled(true);
        }
      }
    }

    void detectInstalled();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanPrompt(false);
      setInstalled(true);
      setIosHintOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!iosHintOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (tipRef.current && target && !tipRef.current.contains(target)) {
        setIosHintOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIosHintOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [iosHintOpen]);

  if (installed) {
    return null;
  }

  const showIosHint = isIos && !canPrompt;

  if (!canPrompt && !showIosHint) {
    return null;
  }

  async function handleInstallClick() {
    if (showIosHint) {
      setIosHintOpen((open) => !open);
      return;
    }

    const deferred = deferredPromptRef.current;
    if (!deferred) {
      return;
    }

    deferredPromptRef.current = null;
    setCanPrompt(false);

    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // userChoice can fail on some browsers; prompt already ran
    }
  }

  return (
    <div className="relative" ref={tipRef}>
      <button
        type="button"
        onClick={() => {
          void handleInstallClick();
        }}
        className="btn-brand-secondary w-full text-center sm:w-auto"
        aria-expanded={showIosHint ? iosHintOpen : undefined}
        aria-controls={showIosHint ? "install-app-ios-hint" : undefined}
      >
        Installa app
      </button>

      {showIosHint && iosHintOpen ? (
        <div
          id="install-app-ios-hint"
          role="status"
          className="absolute left-1/2 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2.5rem))] -translate-x-1/2 rounded-xl border border-white/25 bg-brand-void/95 px-4 py-3 text-left text-sm leading-6 text-brand-mute shadow-lg backdrop-blur"
        >
          <p className="font-medium text-white">Su iPhone</p>
          <p className="mt-1">
            Tocca <span className="text-white">Condividi</span> e poi{" "}
            <span className="text-white">Aggiungi a Home</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
