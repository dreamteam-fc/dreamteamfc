import Link from "next/link";

import { listPublicTournaments } from "@/lib/server/tournaments/read-user-tournament-data";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ENTRIES_SET: "Squadre in selezione",
  BRACKET_GENERATED: "Tabellone pronto",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato"
};

export default async function TournamentsPage() {
  const tournaments = await listPublicTournaments();

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-3xl bg-brand-void text-white shadow-brand">
          <div className="brand-spectrum-bar" />
          <div className="bg-brand-aurora px-6 py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-mute">
              Dream Team FC
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
              Tornei
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-brand-mute sm:text-base">
              Tornei cross-lega a eliminazione. Se sei stato selezionato,
              sblocca l&apos;accesso con la password e schiera le formazioni.
            </p>
          </div>
        </header>

        {tournaments.length === 0 ? (
          <section className="surface-card p-8 text-sm text-slate-600">
            Nessun torneo pubblicato al momento.
          </section>
        ) : (
          <section className="space-y-4">
            {tournaments.map((tournament) => (
              <article
                key={tournament.id}
                className="surface-card flex flex-wrap items-center justify-between gap-4 p-6"
              >
                <div>
                  <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-brand-ink">
                    {tournament.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {STATUS_LABEL[tournament.status] ?? tournament.status} |{" "}
                    {tournament._count.entries} squadre
                    {tournament.lineupsOpen
                      ? " | formazioni aperte"
                      : " | formazioni chiuse"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/tournaments/${tournament.id}`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-blue hover:text-brand-blue"
                  >
                    Tabellone
                  </Link>
                  <Link
                    href={`/tournaments/${tournament.id}/activate`}
                    className="btn-brand"
                  >
                    Sblocca accesso
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}

        <Link href="/" className="text-sm font-semibold text-brand-blue">
          ← Home
        </Link>
      </div>
    </main>
  );
}
