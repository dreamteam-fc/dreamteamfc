import Link from "next/link";

import { resetLeagueDataAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminDashboardData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    error?: string;
    notice?: string;
  }>;
};

function Feedback({
  error,
  notice
}: {
  error?: string;
  notice?: string;
}) {
  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
    </>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { error, notice } = await searchParams;
  const { leagues } = await getAdminDashboardData();

  return (
    <AdminShell
      title="Dashboard amministrazione"
      subtitle="Area admin per gestire leghe, giornate, pagelle assistite e risultati."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Leghe</h2>
            <p className="mt-2 text-sm text-slate-600">
              Crea nuove leghe e monitora capienza, giornate e classifica.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/votes"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
            >
              Pagelle unificate
            </Link>
            <Link
              href="/admin/players"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Giocatori
            </Link>
            <Link
              href="/admin/leagues/new"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Crea nuova lega
            </Link>
          </div>
        </div>
      </section>

      {leagues.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Nessuna lega trovata. Esegui il seed demo prima di usare l&apos;area admin.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {leagues.map((league) => (
            <section
              key={league.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {league.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Membri: {league._count.members} | Squadre:{" "}
                    {league._count.fantasyTeams}/{league.maxTeams} | Posti disponibili:{" "}
                    {league.availableSpots}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/leagues/${league.id}/schedule`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Genera calendario
                  </Link>
                  <Link
                    href={`/admin/leagues/${league.id}/teams`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Squadre / rose
                  </Link>
                  <Link
                    href={`/admin/leagues/${league.id}/players`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Giocatori
                  </Link>
                  <Link
                    href={`/admin/leagues/${league.id}/matchdays/new`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Crea giornata
                  </Link>
                  <Link
                    href={`/leagues/${league.id}`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Pagina pubblica
                  </Link>
                  <Link
                    href={`/admin/leagues/${league.id}/standings`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Vedi classifica
                  </Link>
                  <StatusBadge status={league.status} />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {league.matchdays.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Nessuna giornata disponibile per questa lega.
                  </p>
                ) : (
                  league.matchdays.map((matchday) => (
                    <div
                      key={matchday.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            Giornata {matchday.number}
                          </h3>
                          <p className="mt-2 text-sm text-slate-600">
                            Lineup: {matchday._count.lineups} | Giocatori utili:{" "}
                            {matchday._count.requiredVotes} | Voti salvati:{" "}
                            {matchday._count.playerVotes} | Team score:{" "}
                            {matchday._count.teamScores}
                          </p>
                        </div>
                        <StatusBadge status={matchday.status} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/admin/matchdays/${matchday.id}`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Dettaglio giornata
                        </Link>
                        <Link
                          href={`/admin/matchdays/${matchday.id}/votes`}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                        >
                          Gestisci voti
                        </Link>
                        <Link
                          href={`/admin/matchdays/${matchday.id}/scores`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Vedi punteggi
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Zona pericolosa</h2>
        <p className="mt-2 text-sm text-rose-700">
          Cancella leghe, squadre, rose, giornate, voti, risultati e scontri.
          Mantiene utenti e giocatori.
        </p>

        <form action={resetLeagueDataAction} className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm text-slate-700">
            <span className="font-medium">Conferma reset</span>
            <input
              type="text"
              name="confirmation"
              placeholder="RESET LEGHE"
              className="w-full rounded-xl border border-rose-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            Reset dati leghe
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
