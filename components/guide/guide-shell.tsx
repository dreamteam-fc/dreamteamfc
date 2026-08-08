import Link from "next/link";

import {
  BrandHeader,
  brandHeaderActionClassName
} from "@/components/brand/brand-header";

export const guideSections = [
  {
    description: "Account, area personale e panoramica dei passi.",
    href: "/come-giocare",
    title: "Panoramica"
  },
  {
    description: "Iscrizione, squadra, rosa e classifica di lega.",
    href: "/come-giocare/lega",
    title: "Lega e squadra"
  },
  {
    description: "Quando e come schierare titolari e panchina.",
    href: "/come-giocare/formazioni",
    title: "Formazioni"
  },
  {
    description: "Sblocco accesso, tabellone e formazioni torneo.",
    href: "/come-giocare/tornei",
    title: "Tornei"
  },
  {
    description: "Inviti, accettazione e limiti dell’allenatore.",
    href: "/come-giocare/allenatore",
    title: "Allenatore"
  }
] as const;

type GuideShellProps = {
  children: React.ReactNode;
  currentHref: (typeof guideSections)[number]["href"];
  description: string;
  title: string;
};

export function GuideShell({
  children,
  currentHref,
  description,
  title
}: GuideShellProps) {
  const currentIndex = guideSections.findIndex(
    (section) => section.href === currentHref
  );
  const prev = currentIndex > 0 ? guideSections[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < guideSections.length - 1
      ? guideSections[currentIndex + 1]
      : null;

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <BrandHeader
          title={title}
          description={description}
          actions={
            <>
              <Link href="/" className={brandHeaderActionClassName}>
                Home
              </Link>
              <Link href="/regolamento" className={brandHeaderActionClassName}>
                Regolamento
              </Link>
            </>
          }
        />

        <nav aria-label="Sezioni Come giocare" className="surface-card p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">
            Guida
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {guideSections.map((section, index) => {
              const isCurrent = section.href === currentHref;

              return (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      isCurrent
                        ? "bg-brand-fog font-semibold text-brand-blue"
                        : "font-medium text-slate-700 hover:bg-brand-fog hover:text-brand-blue"
                    }`}
                  >
                    <span className="mt-0.5 font-display text-sm font-bold text-brand-blue">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block">{section.title}</span>
                      <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">
                        {section.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        {children}

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 text-sm">
          {prev ? (
            <Link href={prev.href} className="font-semibold text-brand-blue">
              ← {prev.title}
            </Link>
          ) : (
            <Link href="/" className="font-semibold text-brand-blue">
              ← Home
            </Link>
          )}
          {next ? (
            <Link href={next.href} className="font-semibold text-brand-blue">
              {next.title} →
            </Link>
          ) : (
            <Link href="/regolamento" className="font-semibold text-brand-blue">
              Vai al regolamento →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

export function GuideSection({
  children,
  id,
  title
}: {
  children: React.ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section id={id} className="surface-card scroll-mt-6 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-brand-ink">
        {title}
      </h2>
      <div className="mt-5 space-y-5 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function GuideSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-brand-ink sm:text-lg">
      {children}
    </h3>
  );
}

export function GuideSteps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-3 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  );
}

export function GuideList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
