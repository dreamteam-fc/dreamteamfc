/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Conservative runtime caching:
 * - Cache hashed/static assets for installability + offline shell
 * - Never cache API or document/RSC responses (avoids cross-user data leaks)
 */
const runtimeCaching: RuntimeCaching[] =
  process.env.NODE_ENV !== "production"
    ? [
        {
          matcher: /.*/i,
          handler: new NetworkOnly()
        }
      ]
    : [
        {
          matcher: ({ sameOrigin, url: { pathname } }) =>
            sameOrigin &&
            (pathname.startsWith("/api/") ||
              pathname.startsWith("/auth/") ||
              pathname.includes("/_next/data/")),
          handler: new NetworkOnly()
        },
        {
          matcher: ({ request, sameOrigin }) =>
            sameOrigin &&
            (request.destination === "document" ||
              request.headers.get("RSC") === "1" ||
              request.headers.get("Next-Router-Prefetch") === "1"),
          handler: new NetworkOnly()
        },
        {
          matcher: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
          handler: new CacheFirst({
            cacheName: "google-fonts-webfonts",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 4,
                maxAgeSeconds: 365 * 24 * 60 * 60,
                maxAgeFrom: "last-used"
              })
            ]
          })
        },
        {
          matcher: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
          handler: new StaleWhileRevalidate({
            cacheName: "google-fonts-stylesheets",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 4,
                maxAgeSeconds: 7 * 24 * 60 * 60,
                maxAgeFrom: "last-used"
              })
            ]
          })
        },
        {
          matcher: /\/_next\/static.+/i,
          handler: new CacheFirst({
            cacheName: "next-static-assets",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 128,
                maxAgeSeconds: 24 * 60 * 60,
                maxAgeFrom: "last-used"
              })
            ]
          })
        },
        {
          matcher: /\.(?:js|css)$/i,
          handler: new StaleWhileRevalidate({
            cacheName: "static-script-style-assets",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 64,
                maxAgeSeconds: 24 * 60 * 60,
                maxAgeFrom: "last-used"
              })
            ]
          })
        },
        {
          matcher: ({ sameOrigin, url: { pathname } }) =>
            sameOrigin &&
            (pathname.startsWith("/brand/") ||
              pathname.startsWith("/icons/") ||
              /\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/i.test(pathname)),
          handler: new StaleWhileRevalidate({
            cacheName: "brand-static-assets",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 64,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                maxAgeFrom: "last-used"
              })
            ]
          })
        },
        {
          matcher: /.*/i,
          handler: new NetworkOnly()
        }
      ];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        }
      }
    ]
  }
});

serwist.addEventListeners();
