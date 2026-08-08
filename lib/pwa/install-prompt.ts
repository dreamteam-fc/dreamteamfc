/**
 * Captures `beforeinstallprompt` as early as the client bundle loads.
 * Chrome fires the event once; a React useEffect listener alone can miss it
 * on fast SW activation / return visits, leaving the install CTA forever hidden.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptListener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<InstallPromptListener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  const safariNav = window.navigator as Navigator & { standalone?: boolean };
  return safariNav.standalone === true;
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

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
}

function onAppInstalled() {
  deferredPrompt = null;
  installed = true;
  notify();
}

let listening = false;

/** Idempotent: safe to call from multiple client entry points. */
export function ensureInstallPromptCapture(): void {
  if (typeof window === "undefined" || listening) {
    return;
  }

  listening = true;

  if (isStandaloneDisplay()) {
    installed = true;
  }

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  void hasInstalledRelatedApps().then((related) => {
    if (related) {
      installed = true;
      notify();
    }
  });
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function consumeDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();
  return prompt;
}

export function isAppInstalled(): boolean {
  return installed || (typeof window !== "undefined" && isStandaloneDisplay());
}

export function subscribeInstallPrompt(listener: InstallPromptListener): () => void {
  ensureInstallPromptCapture();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isIosDevice(): boolean {
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
