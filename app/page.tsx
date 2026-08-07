import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";

const gettingStartedSteps = [
  {
    description:
      "Crea il tuo account per entrare nell'area personale.",
    title: "Registrati"
  },
  {
    description:
      "Scegli una lega disponibile e crea la tua squadra.",
    title: "Entra in una lega"
  },
  {
    description:
      "Completa la rosa con 25 giocatori (3P, 8D, 8C, 6A) e preparati per la prossima giornata.",
    title: "Completa la rosa"
  },
  {
    description:
      "Quando la giornata e aperta, scegli titolari e panchina.",
    title: "Schiera la formazione"
  },
  {
    description:
      "Controlla risultati, partite e classifica direttamente dall'app.",
    title: "Segui risultati e classifica"
  }
] as const;

const quickLinks = [
  {
    cta: "Vedi leghe disponibili",
    description:
      "Sfoglia le leghe aperte, guarda calendario, giornate pubblicate e classifica.",
    href: "/leagues",
    title: "Scopri le leghe"
  },
  {
    cta: "Vai alla mia squadra",
    description:
      "Apri la tua area personale per gestire rosa, formazione e calendario.",
    href: "/me",
    title: "La mia squadra"
  },
  {
    cta: "Vedi i tornei",
    description:
      "Tornei cross-lega a eliminazione: tabellone, sblocco accesso e formazioni.",
    href: "/tournaments",
    title: "Tornei"
  },
  {
    cta: "Vedi leghe disponibili",
    description:
      "Segui classifiche e risultati pubblicati anche senza entrare in una lega.",
    href: "/leagues",
    title: "Risultati e classifica"
  }
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-brand-fog">
      <section className="relative overflow-hidden bg-brand-void text-white">
        <div className="brand-spectrum-bar" />
        <div className="pointer-events-none absolute inset-0 bg-brand-aurora" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-5xl flex-col items-center justify-center px-5 py-14 text-center sm:px-6 sm:py-16">
          <BrandMark size="hero" priority href={null} />
          <h1 className="mt-8 max-w-3xl font-display text-4xl font-bold uppercase leading-tight tracking-wide sm:text-5xl md:text-6xl">
            Entra in lega. Costruisci la rosa. Domina la giornata.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-brand-mute sm:text-lg">
            Fantasy calcetto per leghe private: iscrizione, rosa da 25, formazione
            e classifica in un unico posto.
          </p>
          <div className="mt-10 flex w-full max-w-lg flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
            <Link
              href="/leagues"
              className="rounded-xl bg-brand-gold px-6 py-3.5 text-center text-base font-bold text-brand-void transition hover:bg-[#ffd24a]"
            >
              Vedi leghe disponibili
            </Link>
            <Link href="/signup" className="btn-brand-secondary text-center">
              Registrati
            </Link>
            <Link href="/login" className="btn-brand-secondary text-center">
              Accedi
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-10">
          <section className="surface-card p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-blue">
                  Come funziona
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide text-brand-ink">
                  Dal primo accesso alla classifica
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Il percorso e semplice: entri in una lega, prepari la squadra,
                  schieri la formazione e segui ogni partita pubblicata.
                </p>
              </div>

              <Link
                href="/me"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-ink transition hover:border-brand-blue hover:text-brand-blue"
              >
                Vai alla mia squadra
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {gettingStartedSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-brand-fog/60 p-5"
                >
                  <p className="text-sm font-bold text-brand-blue">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-brand-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            {quickLinks.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group surface-card p-6 transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md"
              >
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-brand-ink">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {card.description}
                </p>
                <p className="mt-5 text-sm font-bold text-brand-blue transition group-hover:text-[#0f4de0]">
                  {card.cta}
                </p>
              </Link>
            ))}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <p>Dream Team FC</p>
            <Link
              href="/regolamento"
              className="font-semibold text-brand-blue transition hover:text-[#0f4de0]"
            >
              Regolamento
            </Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
