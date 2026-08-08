"use client";

import { SerwistProvider as Provider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { ensureInstallPromptCapture } from "@/lib/pwa/install-prompt";

type SerwistProviderProps = {
  children: ReactNode;
};

export function SerwistProvider({ children }: SerwistProviderProps) {
  // Start BIP capture as soon as the root client shell mounts (before homepage CTA).
  useEffect(() => {
    ensureInstallPromptCapture();
  }, []);

  return (
    <Provider
      swUrl="/serwist/sw.js"
      // Avoid caching navigations of authenticated App Router pages.
      cacheOnNavigation={false}
      reloadOnOnline
    >
      {children}
    </Provider>
  );
}
