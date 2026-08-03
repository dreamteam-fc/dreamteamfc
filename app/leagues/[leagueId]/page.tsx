import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamLogo } from "@/components/teams/team-logo";
import { getPublicLeagueHomeData } from "@/lib/server/public/read-public-league-data";

export const dynamic = "force-dynamic";

type PublicLeaguePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default async function PublicLeaguePage({
  params
}: PublicLeaguePageProps) {
  const { leagueId } = await params;
  const data = await getPublicLeagueHomeData(leagueId);

  if (!data) {
    notFound();
  }

  const standingsPreview = data.standings.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {data.league.name}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Squadre iscritte: <strong>{data.league.fantasyTeamsCount}</strong> /{" "}
              <strong>{data.league.maxTeams}</strong> | Giornate pubblicate:{" "}
              <strong>{data.league.publishedMatchdaysCount}</strong>
            </p>
          </div>

          <Link
            href={`/leagues/${data.league.id}/standings`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Vedi classifica completa
          </Link>
        </div>

        <div className="mt-4">
          <Link
            href={`/leagues/${data.league.id}/schedule`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Calendario
          </Link>
        </div>

        {data.league.registrationsClosed ? (
          <div className="mt-4 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            Iscrizioni chiuse: il calendario della lega è già stato generato.
          </div>
        ) : data.league.isFull ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Lega piena.
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/leagues/${data.league.id}/join`}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Entra nella lega / Crea la tua squadra
            </Link>
          </div>
        )}

        {data.league.publishedMatchdaysCount === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Nessuna giornata pubblicata disponibile per questa lega.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Classifica sintetica
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Ordinata per punti, differenza reti, gol fatti e fantapunti totali.
            </p>
          </div>
        </div>

        {standingsPreview.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Nessuna squadra disponibile.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="px-3 py-2 font-medium">Squadra</th>
                  <th className="px-3 py-2 font-medium">Punti</th>
                  <th className="px-3 py-2 font-medium">G</th>
                  <th className="px-3 py-2 font-medium">GF</th>
                  <th className="px-3 py-2 font-medium">GS</th>
                  <th className="px-3 py-2 font-medium">Fantapunti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standingsPreview.map((row, index) => (
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
                    <td className="px-3 py-2 text-slate-600">{row.goalsFor}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.goalsAgainst}
                    </td>
                    <td className="px-3 py-2 text-slate-900">
                      {formatScore(row.fantasyPointsTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Giornate pubblicate
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Solo giornate pubblicate o bloccate sono visibili ai partecipanti.
            </p>
          </div>
        </div>

        {data.matchdays.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Nessuna giornata pubblicata da consultare.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {data.matchdays.map((matchday) => (
              <article
                key={matchday.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Giornata {matchday.number}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Team score: {matchday._count.teamScores} | Scontri diretti:{" "}
                      {matchday._count.fixtures}
                    </p>
                  </div>

                  <Link
                    href={`/leagues/${data.league.id}/matchdays/${matchday.id}`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Apri giornata
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
