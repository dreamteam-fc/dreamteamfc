import Link from "next/link";

import {
  generateRandomLineupsForMatchdayAction,
  lockLineupsAction,
  openLineupsAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { RosterPresenceBadge } from "@/components/admin/roster-presence-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireStaffAccess } from "@/lib/auth/admin.ts";
import { canManagePlatform, isAppAdmin } from "@/lib/auth/app-roles.ts";
import { getAdminLineupsHubData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type AdminLineupsPageProps = {
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
  if (!error && !notice) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? notice}
    </div>
  );
}

export default async function AdminLineupsHubPage({
  searchParams
}: AdminLineupsPageProps) {
  const { error, notice } = await searchParams;
  const authContext = await requireStaffAccess();
  const role = authContext.appUser.role;
  const showPlatform = canManagePlatform(role);
  const data = await getAdminLineupsHubData();
  const redirectPath = "/admin/lineups";

  return (
    <AdminShell
      eyebrow={isAppAdmin(role) ? "Admin" : "Mister"}
      title="Formazioni"
      subtitle={`Hub formazioni per leghe complete: esattamente ${data.requiredTeamCount} squadre iscritte e rosa completa (${data.requiredRosterSize}/${data.requiredRosterSize}) su tutte.`}
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Leghe idonee
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Trovate: <strong>{data.eligibleLeagues.length}</strong>. Accedi
              alla giornata utile, genera formazioni casuali o apri le rose.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/votes"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
            >
              Pagelle unificate
            </Link>
          </div>
        </div>
      </section>

      {data.eligibleLeagues.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Nessuna lega idonea. Servono esattamente {data.requiredTeamCount}{" "}
          squadre e rosa completa ({data.requiredRosterSize} giocatori) su tutte.
        </section>
      ) : (
        <div className="space-y-6">
          {data.eligibleLeagues.map((league) => (
            <section
              key={league.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {league.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Squadre: {league.teamCount}/{league.requiredTeamCount} |
                    Rose complete: {league.teamsWithCompleteRoster}/
                    {league.requiredTeamCount}
                  </p>
                </div>
                <StatusBadge status={league.status} />
              </div>

              {league.nextMatchday ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Giornata {league.nextMatchday.number}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Formazioni inserite:{" "}
                        {league.nextMatchday.lineupsCount}/{league.teamCount}
                      </p>
                    </div>
                    <StatusBadge status={league.nextMatchday.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/admin/matchdays/${league.nextMatchday.id}`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Gestisci formazioni
                    </Link>
                    <Link
                      href={`/leagues/${league.id}/matchdays/${league.nextMatchday.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Vista pubblica giornata
                    </Link>
                    {league.nextMatchday.status === "DRAFT" ? (
                      <form
                        action={openLineupsAction.bind(
                          null,
                          league.nextMatchday.id
                        )}
                      >
                        <PendingSubmitButton
                          pendingLabel="Apertura in corso…"
                          className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Apri formazioni
                        </PendingSubmitButton>
                      </form>
                    ) : null}
                    {league.nextMatchday.status === "LINEUPS_OPEN" ? (
                      <form
                        action={lockLineupsAction.bind(
                          null,
                          league.nextMatchday.id
                        )}
                      >
                        <PendingSubmitButton
                          pendingLabel="Chiusura in corso…"
                          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Chiudi formazioni
                        </PendingSubmitButton>
                      </form>
                    ) : null}
                    {showPlatform ? (
                      <>
                        <Link
                          href={`/admin/leagues/${league.id}/teams`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Squadre / rose
                        </Link>
                        <form action={generateRandomLineupsForMatchdayAction}>
                          <input
                            type="hidden"
                            name="leagueId"
                            value={league.id}
                          />
                          <input
                            type="hidden"
                            name="matchdayId"
                            value={league.nextMatchday.id}
                          />
                          <input
                            type="hidden"
                            name="redirectPath"
                            value={redirectPath}
                          />
                          <PendingSubmitButton
                            pendingLabel="Generazione in corso…"
                            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Genera formazioni casuali
                          </PendingSubmitButton>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-600">
                  Tutte le giornate sono pubblicate, oppure non c&apos;è ancora
                  un calendario.
                </p>
              )}

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Squadra</th>
                      <th className="px-4 py-3 font-medium">Utente</th>
                      <th className="px-4 py-3 font-medium">Rosa</th>
                      <th className="px-4 py-3 font-medium">Formazione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {league.teams.map((team) => (
                      <tr key={team.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {team.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {team.ownerDisplayName ?? team.ownerEmail}
                        </td>
                        <td className="px-4 py-3">
                          <RosterPresenceBadge
                            status={team.rosterStatus}
                            countLabel={`${team.rosterCount}/${league.requiredRosterSize}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {showPlatform && league.nextMatchday ? (
                            <Link
                              href={`/me/teams/${team.id}/matchdays/${league.nextMatchday.id}/lineup`}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                            >
                              Apri formazione
                            </Link>
                          ) : league.nextMatchday ? (
                            <Link
                              href={`/admin/matchdays/${league.nextMatchday.id}`}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                            >
                              Stato giornata
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
