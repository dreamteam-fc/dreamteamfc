import Link from "next/link";

import { BrandHeader } from "@/components/brand/brand-header";
import { getPublicLeaguesListData } from "@/lib/server/public/read-public-league-data";

export const dynamic = "force-dynamic";

export default async function PublicLeaguesPage() {
  const leagues = await getPublicLeaguesListData();

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <BrandHeader
          title="Leghe disponibili"
          description="Elenco pubblico delle leghe con disponibilita attuale e accesso rapido alla pagina lega o alla creazione squadra."
        />

        {leagues.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Nessuna lega disponibile al momento.
          </section>
        ) : (
          <section className="space-y-4">
            {leagues.map((league) => (
              <article
                key={league.id}
                className="surface-card rounded-2xl p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-brand-ink">
                      {league.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Squadre iscritte: <strong>{league.fantasyTeamsCount}</strong> /{" "}
                      <strong>{league.maxTeams}</strong> | Posti disponibili:{" "}
                      <strong>{league.availableSpots}</strong>
                    </p>
                    <div
                      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        league.registrationsClosed
                          ? "bg-slate-200 text-slate-700"
                          : league.availableSpots > 0
                          ? "bg-cyan-100 text-cyan-800"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {league.statusLabel}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/leagues/${league.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-blue hover:text-brand-blue"
                    >
                      Vedi lega
                    </Link>
                    {!league.registrationsClosed ? (
                      <Link
                        href={`/leagues/${league.id}/join`}
                        className="btn-brand"
                      >
                        Entra / Crea squadra
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
