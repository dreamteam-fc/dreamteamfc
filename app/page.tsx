import Link from "next/link";

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
    cta: "Vai alla mia squadra",
    description:
      "Se hai gia una squadra, riparti da qui per controllare la prossima giornata.",
    href: "/me",
    title: "Prossima formazione"
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
    <main className="min-h-screen bg-slate-100">
      <section className="bg-gradient-to-br from-pitch via-emerald-800 to-emerald-700 px-5 py-8 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr] lg:items-center">
            <div className="rounded-3xl bg-white/10 p-6 backdrop-blur-sm sm:p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-100">
                Fantacalcetto
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
                Entra in una lega, crea la tua rosa e segui ogni giornata.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50">
                Fantacalcetto e una web app per leghe private di fantasy calcetto:
                scegli una lega, costruisci la tua squadra, schiera la formazione
                e controlla risultati e classifica.
              </p>
              <p className="mt-4 text-sm font-medium text-emerald-100">
                Primo passo: guarda le leghe disponibili e scegli dove giocare.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/leagues"
                  className="rounded-xl bg-white px-5 py-3 text-center text-base font-semibold text-emerald-900 transition hover:bg-emerald-50"
                >
                  Vedi leghe disponibili
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl border border-emerald-200 bg-emerald-500/20 px-5 py-3 text-center text-base font-medium text-white transition hover:bg-emerald-500/30"
                >
                  Registrati
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/40 bg-transparent px-5 py-3 text-center text-base font-medium text-white transition hover:border-white hover:bg-white/10"
                >
                  Accedi
                </Link>
                <Link
                  href="/me"
                  className="rounded-xl border border-white/40 bg-transparent px-5 py-3 text-center text-base font-medium text-white transition hover:border-white hover:bg-white/10"
                >
                  Vai alla mia squadra
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <section className="rounded-3xl bg-white p-6 text-slate-900 shadow-sm">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                  Nuovo? Parti da qui
                </p>
                <h2 className="mt-3 text-xl font-semibold">
                  In pochi passaggi sei pronto a giocare
                </h2>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li>1. Registrati o accedi.</li>
                  <li>2. Entra in una lega disponibile.</li>
                  <li>3. Completa la tua rosa.</li>
                  <li>4. Schiera la formazione per la giornata.</li>
                  <li>5. Segui risultati e classifica.</li>
                </ol>
              </section>

              <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-300">
                  Hai gia una squadra?
                </p>
                <h2 className="mt-3 text-xl font-semibold">
                  Torna nella tua area personale
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Vai alla tua area personale per gestire rosa, formazione,
                  calendario e risultati.
                </p>
                <div className="mt-5">
                  <Link
                    href="/me"
                    className="inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Vai alla mia squadra
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-10">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                  Come funziona
                </p>
                <h2 className="mt-3 text-3xl font-bold text-slate-900">
                  Dal primo accesso alla classifica
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Il percorso e semplice: entri in una lega, prepari la squadra,
                  schieri la formazione e segui ogni partita pubblicata.
                </p>
              </div>

              <Link
                href="/leagues"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Vedi leghe disponibili
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {gettingStartedSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-sm font-semibold text-emerald-700">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
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
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <h2 className="text-xl font-semibold text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {card.description}
                </p>
                <p className="mt-5 text-sm font-semibold text-emerald-700 transition group-hover:text-emerald-800">
                  {card.cta}
                </p>
              </Link>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
