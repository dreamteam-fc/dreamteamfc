"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  consumeDeferredInstallPrompt,
  ensureInstallPromptCapture,
  getDeferredInstallPrompt,
  isAppInstalled,
  isIosDevice,
  subscribeInstallPrompt
} from "@/lib/pwa/install-prompt";

/** Stable snapshot for useSyncExternalStore (must be referentially stable when unchanged). */
let cachedSnapshot = {
  canPrompt: false,
  installed: false
};

function readInstallSnapshot() {
  const next = {
    canPrompt: getDeferredInstallPrompt() !== null,
    installed: isAppInstalled()
  };

  if (
    next.canPrompt === cachedSnapshot.canPrompt &&
    next.installed === cachedSnapshot.installed
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = next;
  return cachedSnapshot;
}

function subscribe(onStoreChange: () => void) {
  return subscribeInstallPrompt(onStoreChange);
}

const serverSnapshot = { canPrompt: false, installed: false };

export function InstallAppButton() {
  const { canPrompt, installed } = useSyncExternalStore(
    subscribe,
    readInstallSnapshot,
    () => serverSnapshot
  );
  const [isIos, setIsIos] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureInstallPromptCapture();
    setIsIos(isIosDevice());
  }, []);

  useEffect(() => {
    if (!hintOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (tipRef.current && target && !tipRef.current.contains(target)) {
        setHintOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHintOpen(false);
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
  }, [hintOpen]);

  if (installed) {
    return null;
  }

  // Always show when not installed: BIP may arrive late (or never on Firefox /
  // in-app browsers). Native prompt when available; otherwise platform instructions.
  const needsManualHint = !canPrompt;

  async function handleInstallClick() {
    if (needsManualHint) {
      setHintOpen((open) => !open);
      return;
    }

    const deferred = consumeDeferredInstallPrompt();
    if (!deferred) {
      setHintOpen(true);
      return;
    }

    setHintOpen(false);
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // userChoice can fail on some browsers; prompt already ran
    }
  }

  return (
    <div className="relative sm:hidden" ref={tipRef}>
      <button
        type="button"
        onClick={() => {
          void handleInstallClick();
        }}
        className="btn-brand-secondary w-full text-center"
        aria-expanded={needsManualHint ? hintOpen : undefined}
        aria-controls={needsManualHint ? "install-app-hint" : undefined}
      >
        Installa app
      </button>

      {needsManualHint && hintOpen ? (
        <div
          id="install-app-hint"
          role="status"
          className="absolute left-1/2 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2.5rem))] -translate-x-1/2 rounded-xl border border-white/25 bg-brand-void/95 px-4 py-3 text-left text-sm leading-6 text-brand-mute shadow-lg backdrop-blur"
        >
          {isIos ? (
            <>
              <p className="font-medium text-white">Su iPhone / iPad</p>
              <p className="mt-1">
                Tocca <span className="text-white">Condividi</span> e poi{" "}
                <span className="text-white">Aggiungi a Home</span>.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-white">Dal browser</p>
              <p className="mt-1">
                Apri il menu <span className="text-white">⋮</span> o{" "}
                <span className="text-white">⋯</span> e scegli{" "}
                <span className="text-white">Installa app</span> oppure{" "}
                <span className="text-white">Aggiungi a schermata Home</span>.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
