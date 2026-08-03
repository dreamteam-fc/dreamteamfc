import Link from "next/link";

import {
  generateAllLeagueSchedulesAction,
  generateRandomLineupsForMatchdayAction,
  resetLeagueDataAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { PlatformRolesPanel } from "@/components/admin/platform-roles-panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireStaffAccess } from "@/lib/auth/admin.ts";
import {
  canAssignAppRoles,
  canManagePlatform,
  isAppAdmin
} from "@/lib/auth/app-roles.ts";
import { getNextUsefulMatchday } from "@/lib/matchdays/next-useful-matchday";
import {
  getAdminDashboardData,
  getAdminPlatformUsersData
} from "@/lib/server/admin/read-admin-data";

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
  const showRoles = canAssignAppRoles(role);
  const { leagues } = await getAdminDashboardData();
  const platformUsers = showRoles
    ? (await getAdminPlatformUsersData()).users
    : [];

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
          : "Gestisci pagelle Fantacalcio, calendario, giornate e calcolo punteggi."
      }
    >
      <Feedback error={error} notice={notice} />

      {showRoles ? <PlatformRolesPanel users={platformUsers} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Leghe</h2>
            <p className="mt-2 text-sm text-slate-600">
              {showPlatform
                ? "Crea nuove leghe e monitora capienza, giornate e classifica."
                : "Calendario, giornate, pagelle e punteggi delle leghe attive."}
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
            <Link
              href="/admin/lineups"
              className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:border-sky-400 hover:bg-sky-100"
            >
              Apri formazioni
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

      {showPlatform ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Zona pericolosa
          </h2>
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
      ) : null}
    </AdminShell>
  );
}
