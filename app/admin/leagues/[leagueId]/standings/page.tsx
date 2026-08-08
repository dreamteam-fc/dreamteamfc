import { notFound } from "next/navigation";

import {
  clearLeagueStandingsTieBreakOrderAction,
  setLeagueStandingsTieBreakOrderAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminLeagueStandingsData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type StandingsPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    notice?: string;
  }>;
};

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default async function AdminLeagueStandingsPage({
  params,
  searchParams
}: StandingsPageProps) {
  const { leagueId } = await params;
  const { error, notice } = await searchParams;
  const data = await getAdminLeagueStandingsData(leagueId);

  if (!data) {
    notFound();
  }

  return (
    <AdminShell
      title={`Classifica | ${data.league.name}`}
      subtitle={`Stato lega ${data.league.status} | Team ${data.league._count.fantasyTeams} | Giornate ${data.league._count.matchdays}`}
    >
      {notice ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}
      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Classifica lega</h2>
            <p className="mt-2 text-sm text-slate-600">
              Ordine: punti → fantapunti → differenza reti → scelta admin.
            </p>
          </div>
          <StatusBadge status={data.league.status} />
        </div>
      </section>

      {data.pendingTieGroups.length > 0 ? (
        <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-amber-950">
              Parità da risolvere
            </h3>
            <p className="mt-1 text-sm text-amber-900/80">
              Stessi punti, fantapunti e differenza reti. Scegli chi sta sopra
              (1 = posto migliore nel gruppo).
            </p>
          </div>
          {data.pendingTieGroups.map((group) => (
            <div
              key={group.teamIds.join("-")}
              className="rounded-2xl border border-amber-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-slate-800">
                Gruppo: {group.teamNames.join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.teamIds.map((teamId, index) => {
                  const orderedTeamIds = [
                    teamId,
                    ...group.teamIds.filter((id) => id !== teamId)
                  ];
                  return (
                    <form
                      key={teamId}
                      action={setLeagueStandingsTieBreakOrderAction}
                    >
                      <input type="hidden" name="leagueId" value={leagueId} />
                      {orderedTeamIds.map((id) => (
                        <input
                          key={id}
                          type="hidden"
                          name="orderedTeamIds"
                          value={id}
                        />
                      ))}
                      <button
                        type="submit"
                        className="rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
                      >
                        Metti 1°: {group.teamNames[index]}
                      </button>
                    </form>
                  );
                })}
              </div>
              <form
                action={clearLeagueStandingsTieBreakOrderAction}
                className="mt-3"
              >
                <input type="hidden" name="leagueId" value={leagueId} />
                {group.teamIds.map((id) => (
                  <input key={id} type="hidden" name="teamIds" value={id} />
                ))}
                <button
                  type="submit"
                  className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                >
                  Reset scelta su questo gruppo
                </button>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      {data.standings.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Nessuna fantasy team disponibile per questa lega.
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="px-3 py-2 font-medium">Squadra</th>
                  <th className="px-3 py-2 font-medium">Punti</th>
                  <th className="px-3 py-2 font-medium">G</th>
                  <th className="px-3 py-2 font-medium">V</th>
                  <th className="px-3 py-2 font-medium">N</th>
                  <th className="px-3 py-2 font-medium">P</th>
                  <th className="px-3 py-2 font-medium">GF</th>
                  <th className="px-3 py-2 font-medium">GS</th>
                  <th className="px-3 py-2 font-medium">DR</th>
                  <th className="px-3 py-2 font-medium">Fantapunti</th>
                  <th className="px-3 py-2 font-medium">Best score</th>
                  <th className="px-3 py-2 font-medium">Tie-break</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.standings.map((row, index) => (
                  <tr key={row.teamId}>
                    <td className="px-3 py-2 text-slate-900">{index + 1}</td>
                    <td className="px-3 py-2 text-slate-900">
                      {row.teamName}
                      {row.needsAdminTieBreak ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                          Parità
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-900">{row.leaguePoints}</td>
                    <td className="px-3 py-2 text-slate-600">{row.played}</td>
                    <td className="px-3 py-2 text-slate-600">{row.wins}</td>
                    <td className="px-3 py-2 text-slate-600">{row.draws}</td>
                    <td className="px-3 py-2 text-slate-600">{row.losses}</td>
                    <td className="px-3 py-2 text-slate-600">{row.goalsFor}</td>
                    <td className="px-3 py-2 text-slate-600">{row.goalsAgainst}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.goalDifference}
                    </td>
                    <td className="px-3 py-2 text-slate-900">
                      {formatScore(row.fantasyPointsTotal)}
                    </td>
                    <td className="px-3 py-2 text-slate-900">
                      {formatScore(row.bestFantasyScore)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.standingsTieBreakRank ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
