import Link from "next/link";

import {
  calculateAllScoresAndResultsAction,
  generateAllLeagueSchedulesAction,
  generateAllRandomLineupsAction,
  generateRandomLineupsForMatchdayAction,
  lockAllLineupsAction,
  lockLineupsAction,
  openAllLineupsAction,
  openLineupsAction,
  publishAllMatchdaysAction,
  wipeLeaguesAction,
  wipeTournamentsAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireStaffAccess } from "@/lib/auth/admin.ts";
import { canManagePlatform, isAppAdmin } from "@/lib/auth/app-roles.ts";
import { getNextUsefulMatchday } from "@/lib/matchdays/next-useful-matchday";
import { getAdminDashboardData } from "@/lib/server/admin/read-admin-data";
import { getPlayerCatalogImportMode } from "@/lib/server/players/sync-fantacalcio-quotazioni-catalog";

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
  const authContext = await requireStaffAccess();
  const role = authContext.appUser.role;
  const showPlatform = canManagePlatform(role);
  const [{ leagues }, catalogMode] = await Promise.all([
    getAdminDashboardData(),
    showPlatform
      ? getPlayerCatalogImportMode()
      : Promise.resolve(null)
  ]);

  return (
    <AdminShell
      eyebrow={isAppAdmin(role) ? "Admin" : "Mister"}
      title={
        isAppAdmin(role)
          ? "Dashboard amministrazione"
          : "Dashboard operativa"
      }
      subtitle={
        isAppAdmin(role)
          ? "Area admin per gestire leghe, giornate, pagelle assistite e risultati."
          : "Gestisci pagelle Fantacalcio, apertura/chiusura formazioni per giornata, calendario e punteggi."
      }
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Leghe</h2>
            <p className="mt-2 text-sm text-slate-600">
              {showPlatform
                ? "Crea nuove leghe e monitora capienza, giornate e classifica."
                : "Apri/chiudi formazioni sulla giornata utile di ogni lega, poi pagelle e punteggi."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {showPlatform ? (
              <Link
                href="/admin/tournaments"
                className="rounded-xl border border-brand-blue/30 bg-blue-50 px-4 py-2 text-sm font-medium text-brand-blue transition hover:bg-blue-100"
              >
                Tornei
              </Link>
            ) : null}
            <Link
              href="/admin/votes"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
            >
              Pagelle unificate
            </Link>
            <form action={openAllLineupsAction}>
              <input type="hidden" name="redirectPath" value="/admin" />
              <PendingSubmitButton
                pendingLabel="Apertura formazioni…"
                className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apri formazioni (tutte)
              </PendingSubmitButton>
            </form>
            <form action={lockAllLineupsAction}>
              <input type="hidden" name="redirectPath" value="/admin" />
              <PendingSubmitButton
                pendingLabel="Chiusura formazioni…"
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Chiudi formazioni (tutte)
              </PendingSubmitButton>
            </form>
            <Link
              href="/admin/lineups"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Hub formazioni
            </Link>
            {showPlatform ? (
              <>
                <form action={generateAllLeagueSchedulesAction}>
                  <input type="hidden" name="redirectPath" value="/admin" />
                  <PendingSubmitButton
                    pendingLabel="Generazione calendari…"
                    className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Genera calendari
                  </PendingSubmitButton>
                </form>
                <form action={generateAllRandomLineupsAction}>
                  <input type="hidden" name="redirectPath" value="/admin" />
                  <PendingSubmitButton
                    pendingLabel="Generazione formazioni…"
                    className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 transition hover:border-orange-400 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Genera formazioni
                  </PendingSubmitButton>
                </form>
                <form action={calculateAllScoresAndResultsAction}>
                  <input type="hidden" name="redirectPath" value="/admin" />
                  <PendingSubmitButton
                    pendingLabel="Calcolo punteggi…"
                    className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Calcola punteggi e risultati
                  </PendingSubmitButton>
                </form>
                <form action={publishAllMatchdaysAction}>
                  <input type="hidden" name="redirectPath" value="/admin" />
                  <PendingSubmitButton
                    pendingLabel="Pubblicazione giornate…"
                    className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 transition hover:border-indigo-400 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Pubblica giornate
                  </PendingSubmitButton>
                </form>
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
              </>
            ) : null}
          </div>
        </div>
      </section>

      {leagues.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Nessuna lega trovata. Esegui il seed demo prima di usare l&apos;area
            admin.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {leagues.map((league) => {
            const nextMatchday = getNextUsefulMatchday(league.matchdays);

            return (
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
                      {league._count.fantasyTeams}/{league.maxTeams} | Posti
                      disponibili: {league.availableSpots} | Rose complete:{" "}
                      {league.teamsWithCompleteRoster}/
                      {league._count.fantasyTeams}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/admin/leagues/${league.id}/schedule`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Genera calendario
                    </Link>
                    {showPlatform ? (
                      <>
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
                      </>
                    ) : null}
                    <Link
                      href={`/leagues/${league.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Vedi lega
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
                  ) : nextMatchday ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            Giornata {nextMatchday.number}
                          </h3>
                          <p className="mt-2 text-sm text-slate-600">
                            Lineup: {nextMatchday._count.lineups} | Giocatori
                            utili: {nextMatchday._count.requiredVotes} | Voti
                            salvati: {nextMatchday._count.playerVotes} | Team
                            score: {nextMatchday._count.teamScores}
                          </p>
                        </div>
                        <StatusBadge status={nextMatchday.status} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/admin/matchdays/${nextMatchday.id}`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Dettaglio giornata
                        </Link>
                        <Link
                          href={`/admin/matchdays/${nextMatchday.id}/votes`}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                        >
                          Gestisci voti
                        </Link>
                        <Link
                          href={`/admin/matchdays/${nextMatchday.id}/scores`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Vedi punteggi
                        </Link>
                        {showPlatform && league.teamsWithRoster > 0 ? (
                          <form action={generateRandomLineupsForMatchdayAction}>
                            <input type="hidden" name="leagueId" value={league.id} />
                            <input
                              type="hidden"
                              name="matchdayId"
                              value={nextMatchday.id}
                            />
                            <input type="hidden" name="redirectPath" value="/admin" />
                            <PendingSubmitButton
                              pendingLabel="Generazione in corso…"
                              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Genera formazioni casuali
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                        {nextMatchday.status === "DRAFT" ? (
                          <form
                            action={openLineupsAction.bind(null, nextMatchday.id)}
                          >
                            <PendingSubmitButton
                              pendingLabel="Apertura in corso…"
                              className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Apri formazioni
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                        {nextMatchday.status === "LINEUPS_OPEN" ? (
                          <form action={lockLineupsAction.bind(null, nextMatchday.id)}>
                            <PendingSubmitButton
                              pendingLabel="Chiusura in corso…"
                              className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Chiudi formazioni
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Tutte le giornate sono pubblicate
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showPlatform && catalogMode ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Fine anno / zona pericolosa
          </h2>
          <p className="mt-2 text-sm text-rose-700">
            Ordine obbligatorio: 1) WIPE TORNEO → 2) WIPE LEGHE → 3) upload XLS
            giocatori su{" "}
            <Link href="/admin/players" className="underline">
              /admin/players
            </Link>{" "}
            (wipe lista solo se leghe e tornei = 0).
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Stato attuale: tornei={catalogMode.tournamentCount}, leghe=
            {catalogMode.leagueCount}. Mode upload lista:{" "}
            <strong>{catalogMode.mode === "wipe" ? "WIPE" : "SYNC"}</strong>.
          </p>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <form action={wipeTournamentsAction} className="space-y-4">
              <input type="hidden" name="redirectPath" value="/admin" />
              <h3 className="text-sm font-semibold text-slate-900">
                1. WIPE TORNEO
              </h3>
              <p className="text-sm text-slate-600">
                Elimina tutti i tornei e i dati collegati. Non tocca le leghe.
              </p>
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">
                  Digita <code>WIPE TORNEO</code> per confermare
                </span>
                <input
                  type="text"
                  name="confirmation"
                  placeholder="WIPE TORNEO"
                  autoComplete="off"
                  className="w-full rounded-xl border border-rose-300 px-3 py-2"
                />
              </label>
              <PendingSubmitButton
                pendingLabel="Wipe tornei…"
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                WIPE TORNEO
              </PendingSubmitButton>
            </form>

            <form action={wipeLeaguesAction} className="space-y-4">
              <input type="hidden" name="redirectPath" value="/admin" />
              <h3 className="text-sm font-semibold text-slate-900">
                2. WIPE LEGHE
              </h3>
              <p className="text-sm text-slate-600">
                Elimina leghe, squadre, rose, giornate, voti e risultati. Rifiuta
                se esistono ancora tornei.
              </p>
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">
                  Digita <code>WIPE LEGHE</code> per confermare
                </span>
                <input
                  type="text"
                  name="confirmation"
                  placeholder="WIPE LEGHE"
                  autoComplete="off"
                  className="w-full rounded-xl border border-rose-300 px-3 py-2"
                />
              </label>
              <PendingSubmitButton
                pendingLabel="Wipe leghe…"
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                WIPE LEGHE
              </PendingSubmitButton>
            </form>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
