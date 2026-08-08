import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

import { BrandHeader, brandHeaderActionClassName } from "@/components/brand/brand-header";
import { TeamScorePlayersTable } from "@/components/scores/team-score-players-table";
import { getPublicTournamentGiornataData } from "@/lib/server/public/read-public-tournament-giornata";
import type { TournamentVoteLeg } from "@/lib/server/tournaments/tournament-round-leg";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    roundId: string;
    tournamentId: string;
  }>;
  searchParams: Promise<{
    leg?: string;
  }>;
};

const LINEUPS_STATUS_LABELS: Record<TournamentRoundLineupsStatus, string> = {
  DRAFT: "Non aperte",
  LOCKED: "Chiuse",
  OPEN: "Aperte"
};

const FIXTURE_STATUS_LABELS: Record<TournamentFixtureStatus, string> = {
  COMPLETED: "Completata",
  READY: "Pronta",
  SCHEDULED: "In attesa"
};

function formatScore(value: number | null) {
  if (value === null) {
    return "-";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseLeg(value: string | undefined, isFinal: boolean): TournamentVoteLeg {
  if (isFinal) {
    return 1;
  }
  return value === "2" ? 2 : 1;
}

export default async function PublicTournamentGiornataPage({
  params,
  searchParams
}: PageProps) {
  const { tournamentId, roundId } = await params;
  const { leg: legParam } = await searchParams;

  // Probe isFinal via leg 1 first if needed
  let leg = parseLeg(legParam, false);
  let data = await getPublicTournamentGiornataData(tournamentId, roundId, leg);

  if (!data && leg === 2) {
    leg = 1;
    data = await getPublicTournamentGiornataData(tournamentId, roundId, 1);
  }

  if (!data) {
    notFound();
  }

  leg = data.leg;

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <BrandHeader
          title={data.giornataLabel}
          description={`${data.tournament.name} · Formazioni: ${LINEUPS_STATUS_LABELS[data.lineupsStatus]}`}
          actions={
            <>
              <Link
                href={`/tournaments/${data.tournament.id}`}
                className={brandHeaderActionClassName}
              >
                Tabellone
              </Link>
              <Link href="/tournaments" className={brandHeaderActionClassName}>
                Tutti i tornei
              </Link>
            </>
          }
        />

        {!data.round.isFinal ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/tournaments/${tournamentId}/giornate/${roundId}?leg=1`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                leg === 1
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              Andata
            </Link>
            <Link
              href={`/tournaments/${tournamentId}/giornate/${roundId}?leg=2`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                leg === 2
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              Ritorno
            </Link>
          </div>
        ) : null}

        {!data.resultsPublished ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
            Risultati non ancora calcolati per questa giornata. Gli
            accoppiamenti sono visibili; le pagelle compariranno dopo il calcolo
            admin.
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Scontri</h2>
          <p className="mt-2 text-sm text-slate-600">
            {data.resultsPublished
              ? "Risultati con fantapunti, bonus/malus e dettaglio giocatori."
              : "Accoppiamenti della giornata."}
          </p>

          {data.fixtures.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Nessuna partita in questa giornata.
            </p>
          ) : (
            <div className="mt-5 grid gap-4">
              {data.fixtures.map((fixture) => (
                <article
                  key={fixture.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {data.resultsPublished ? (
                          <>
                            {fixture.homeTeam?.name ?? "Da definire"}{" "}
                            {fixture.homeGoals ?? "-"} -{" "}
                            {fixture.awayGoals ?? "-"}{" "}
                            {fixture.awayTeam?.name ?? "Da definire"}
                          </>
                        ) : (
                          <>
                            {fixture.homeTeam?.name ?? "Da definire"} vs{" "}
                            {fixture.awayTeam?.name ?? "Da definire"}
                          </>
                        )}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Stato:{" "}
                        <strong>{FIXTURE_STATUS_LABELS[fixture.status]}</strong>
                      </p>
                    </div>
                  </div>

                  {data.resultsPublished ? (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-medium text-slate-900">
                            {fixture.homeTeam?.name ?? "Casa"}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            Fantasy gol:{" "}
                            <strong>{fixture.homeGoals ?? "-"}</strong>
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Fantapunti:{" "}
                            <strong>
                              {formatScore(
                                fixture.homeScore?.totalScore ??
                                  fixture.persistedHomeFantapunti
                              )}
                            </strong>
                            {fixture.homeScore &&
                            fixture.homeScore.fantapuntiPenalty > 0
                              ? ` (−${fixture.homeScore.fantapuntiPenalty} penale)`
                              : null}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-medium text-slate-900">
                            {fixture.awayTeam?.name ?? "Ospite"}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            Fantasy gol:{" "}
                            <strong>{fixture.awayGoals ?? "-"}</strong>
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Fantapunti:{" "}
                            <strong>
                              {formatScore(
                                fixture.awayScore?.totalScore ??
                                  fixture.persistedAwayFantapunti
                              )}
                            </strong>
                            {fixture.awayScore &&
                            fixture.awayScore.fantapuntiPenalty > 0
                              ? ` (−${fixture.awayScore.fantapuntiPenalty} penale)`
                              : null}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5 xl:grid-cols-2">
                        <TeamScorePlayersTable
                          teamName={fixture.homeTeam?.name ?? "Casa"}
                          totalScore={
                            fixture.homeScore?.totalScore ??
                            fixture.persistedHomeFantapunti
                          }
                          players={fixture.homeScore?.players ?? []}
                        />
                        <TeamScorePlayersTable
                          teamName={fixture.awayTeam?.name ?? "Ospite"}
                          totalScore={
                            fixture.awayScore?.totalScore ??
                            fixture.persistedAwayFantapunti
                          }
                          players={fixture.awayScore?.players ?? []}
                        />
                      </div>
                    </>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
