import { notFound } from "next/navigation";

import { TeamLogo } from "@/components/teams/team-logo";
import { getPublicLeagueStandingsData } from "@/lib/server/public/read-public-league-data";

export const dynamic = "force-dynamic";

type PublicStandingsPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default async function PublicLeagueStandingsPage({
  params
}: PublicStandingsPageProps) {
  const { leagueId } = await params;
  const data = await getPublicLeagueStandingsData(leagueId);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Classifica lega</h2>
        <p className="mt-2 text-sm text-slate-600">
          Giornate pubblicate: <strong>{data.league.publishedMatchdaysCount}</strong>{" "}
          su <strong>{data.league.totalMatchdaysCount}</strong> | Team:{" "}
          <strong>{data.league.fantasyTeamsCount}</strong>
        </p>
      </section>

      {data.standings.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Nessuna squadra disponibile per questa lega.
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Posizione</th>
                  <th className="px-3 py-2 font-medium">Squadra</th>
                  <th className="px-3 py-2 font-medium">Punti</th>
                  <th className="px-3 py-2 font-medium">Giocate</th>
                  <th className="px-3 py-2 font-medium">Vinte</th>
                  <th className="px-3 py-2 font-medium">Pareggiate</th>
                  <th className="px-3 py-2 font-medium">Perse</th>
                  <th className="px-3 py-2 font-medium">GF</th>
                  <th className="px-3 py-2 font-medium">GS</th>
                  <th className="px-3 py-2 font-medium">DR</th>
                  <th className="px-3 py-2 font-medium">Fantapunti totali</th>
                  <th className="px-3 py-2 font-medium">Miglior punteggio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.standings.map((row, index) => (
                  <tr key={row.teamId}>
                    <td className="px-3 py-2 text-slate-900">{index + 1}</td>
                    <td className="px-3 py-2 text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <TeamLogo
                          alt={`Logo ${row.teamName}`}
                          cacheBust={row.logoUpdatedAt}
                          logoPath={row.logoPath}
                          size="sm"
                        />
                        {row.teamName}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
