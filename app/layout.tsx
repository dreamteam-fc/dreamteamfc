import type { Metadata } from "next";
import { Manrope, Oswald } from "next/font/google";

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

export const metadata: Metadata = {
  title: "Dream Team FC",
  description: "Passione per il fantacalcio — leghe private, rose e formazioni.",
  icons: {
    icon: "/brand/logo.png"
  }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="it" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
