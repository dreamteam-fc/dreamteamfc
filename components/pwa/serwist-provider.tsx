"use client";

import { SerwistProvider as Provider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

type SerwistProviderProps = {
  children: ReactNode;
};

export function SerwistProvider({ children }: SerwistProviderProps) {
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
