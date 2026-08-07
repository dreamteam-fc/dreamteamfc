import type { Metadata, Viewport } from "next";
import { Manrope, Oswald } from "next/font/google";

import { SerwistProvider } from "@/components/pwa/serwist-provider";

import "./globals.css";

const display = Oswald({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"]
});

const APP_NAME = "Dream Team FC";
const APP_DESCRIPTION =
  "Passione per il fantacalcio — leghe private, rose e formazioni.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/brand/logo.png?v=3"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a5fff" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" }
  ]
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="it" className={`${display.variable} ${body.variable}`}>
      <body>
        <SerwistProvider>{children}</SerwistProvider>
      </body>
    </html>
  );
}
