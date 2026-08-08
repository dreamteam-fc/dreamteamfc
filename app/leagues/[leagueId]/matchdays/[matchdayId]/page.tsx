import {
  FantasyFixtureStatus,
  MatchdayStatus
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamScorePlayersTable } from "@/components/scores/team-score-players-table";
import {
  getFixtureAdminNote,
  getFixtureForfeitOutcome
} from "@/lib/server/fixtures/fixture-forfeit";
import { getPublicMatchdayDetailData } from "@/lib/server/public/read-public-league-data";

export const dynamic = "force-dynamic";

type PublicMatchdayPageProps = {
  params: Promise<{
    leagueId: string;
    matchdayId: string;
  }>;
};

const MATCHDAY_STATUS_LABELS: Record<MatchdayStatus, string> = {
  DRAFT: "Bozza",
  LINEUPS_LOCKED: "Formazioni chiuse",
  LINEUPS_OPEN: "Formazioni aperte",
  LOCKED: "Bloccata",
  PUBLISHED: "Pubblicata",
  SCORES_CALCULATED: "Punteggi calcolati",
  VOTES_COMPLETED: "Voti completati",
  VOTES_PENDING: "Voti in compilazione"
};

const FIXTURE_STATUS_LABELS: Record<FantasyFixtureStatus, string> = {
  CALCULATED: "Calcolato",
  LOCKED: "Bloccato",
  PUBLISHED: "Pubblicato",
  SCHEDULED: "Programmato"
};

function formatScore(value: number | null) {
  if (value === null) {
    return "-";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getFixtureResultLabel(input: {
  awayTeamScoreId: string | null;
  homeTeamScoreId: string | null;
}) {
  const outcome = getFixtureForfeitOutcome(input);

  if (outcome === "DOUBLE_FORFEIT") {
    return "Doppio forfait";
  }

  if (outcome === "HOME_WIN_BY_FORFEIT" || outcome === "AWAY_WIN_BY_FORFEIT") {
    return "Vittoria a tavolino";
  }

  return "Risultato calcolato";
}

export default async function PublicMatchdayPage({
  params
}: PublicMatchdayPageProps) {
  const { leagueId, matchdayId } = await params;
  const data = await getPublicMatchdayDetailData(leagueId, matchdayId);

  if (!data) {
    notFound();
  }

  const teamScoresByTeamId = new Map(
    data.matchday.teamScores.map((teamScore) => [
      teamScore.fantasyTeam.id,
      teamScore
    ])
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              {data.matchday.league.name}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Giornata {data.matchday.number}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Stato:{" "}
              <strong>{MATCHDAY_STATUS_LABELS[data.matchday.status]}</strong> |
              Squadre: <strong>{data.matchday.league.fantasyTeamsCount}</strong>{" "}
              / <strong>{data.matchday.league.maxTeams}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/me"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Torna alla dashboard
            </Link>
            <Link
              href={`/leagues/${data.matchday.league.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Torna alla lega
            </Link>
            <Link
              href={`/leagues/${data.matchday.league.id}/schedule`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Calendario lega
            </Link>
            <Link
              href={`/leagues/${data.matchday.league.id}/standings`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Classifica lega
            </Link>
          </div>
        </div>
      </section>

      {!data.isPublished ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          Risultati non ancora pubblicati.
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Scontri della giornata
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {data.isPublished
            ? "Risultati con fantapunti, bonus/malus e note di tavolino."
            : "Sono visibili gli accoppiamenti, ma risultati e dettagli restano nascosti fino alla pubblicazione."}
        </p>

        {data.matchday.fixtures.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Giornata non ancora generata.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {data.matchday.fixtures.map((fixture) => {
              const forfeitOutcome = getFixtureForfeitOutcome({
                awayTeamScoreId: fixture.awayTeamScore?.id ?? null,
                homeTeamScoreId: fixture.homeTeamScore?.id ?? null
              });
              const forfeitNote = data.isPublished
                ? getFixtureAdminNote(forfeitOutcome)
                : null;
              const resultLabel = data.isPublished
                ? getFixtureResultLabel({
                    awayTeamScoreId: fixture.awayTeamScore?.id ?? null,
                    homeTeamScoreId: fixture.homeTeamScore?.id ?? null
                  })
                : null;
              const homeTeamScore =
                teamScoresByTeamId.get(fixture.homeTeam.id) ?? null;
              const awayTeamScore =
                teamScoresByTeamId.get(fixture.awayTeam.id) ?? null;

              return (
                <article
                  key={fixture.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {data.isPublished ? (
                          <>
                            {fixture.homeTeam.name} {fixture.homeGoals ?? "-"} -{" "}
                            {fixture.awayGoals ?? "-"} {fixture.awayTeam.name}
                          </>
                        ) : (
                          <>
                            {fixture.homeTeam.name} vs {fixture.awayTeam.name}
                          </>
                        )}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Stato fixture:{" "}
                        <strong>{FIXTURE_STATUS_LABELS[fixture.status]}</strong>
                      </p>
                    </div>

                    {resultLabel ? (
                      <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {resultLabel}
                      </span>
                    ) : null}
                  </div>

                  {data.isPublished ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">
                          {fixture.homeTeam.name}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Fantasy gol:{" "}
                          <strong>{fixture.homeGoals ?? "-"}</strong>
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Punteggio totale:{" "}
                          <strong>
                            {formatScore(homeTeamScore?.totalScore ?? null)}
                          </strong>
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">
                          {fixture.awayTeam.name}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Fantasy gol:{" "}
                          <strong>{fixture.awayGoals ?? "-"}</strong>
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Punteggio totale:{" "}
                          <strong>
                            {formatScore(awayTeamScore?.totalScore ?? null)}
                          </strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-600">
                      Risultati non ancora pubblicati.
                    </p>
                  )}

                  {forfeitNote ? (
                    <p className="mt-4 text-sm text-amber-700">{forfeitNote}</p>
                  ) : null}

                  {data.isPublished ? (
                    <div className="mt-5 grid gap-5 xl:grid-cols-2">
                      {[fixture.homeTeam, fixture.awayTeam].map((team) => {
                        const teamScore = teamScoresByTeamId.get(team.id);

                        return (
                          <TeamScorePlayersTable
                            key={team.id}
                            teamName={team.name}
                            totalScore={teamScore?.totalScore ?? null}
                            players={teamScore?.players ?? []}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {data.matchday.restingTeams.length > 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {data.matchday.restingTeams.length === 1
              ? `Turno di riposo: ${data.matchday.restingTeams[0].name}`
              : `Riposo/non abbinate: ${data.matchday.restingTeams
                  .map((team) => team.name)
                  .join(", ")}`}
          </div>
        ) : null}
      </section>
    </div>
  );
}
