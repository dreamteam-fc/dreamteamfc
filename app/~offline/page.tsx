import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-fog px-6 py-12 text-center">
      <BrandMark href={null} size="lg" priority />
      <h1 className="mt-8 font-display text-3xl font-bold uppercase tracking-wide text-brand-ink">
        Sei offline
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
        Dream Team FC non è raggiungibile in questo momento. Controlla la
        connessione e riprova.
      </p>
      <Link href="/" className="btn-brand mt-8 inline-flex">
        Riprova
      </Link>
    </main>
  );
}
