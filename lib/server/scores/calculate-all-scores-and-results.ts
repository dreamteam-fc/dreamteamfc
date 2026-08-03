import { MatchdayStatus } from "@prisma/client";

import { getNextUsefulMatchday } from "../../matchdays/next-useful-matchday.ts";
import { prisma } from "../../prisma.ts";
import { isRequiredVoteCompletedStatus } from "../votes/shared.ts";
import { calculateFantasyFixtureResults } from "../fixtures/calculate-fantasy-fixture-results.ts";
import { calculateMatchdayScores } from "./calculate-matchday-scores.ts";

export type CalculateAllScoresAndResultsOptions = {
  /**
   * When set (pagelle unificate), process that matchday number per league.
   * Otherwise target each league's next useful matchday (dashboard batch).
   */
  matchdayNumber?: number;
};

export type CalculateAllScoresAndResultsResult = {
  calculated: Array<{
    fixturesCalculated: number;
    leagueId: string;
    leagueName: string;
    matchdayId: string;
    matchdayNumber: number;
    teamsScored: number;
  }>;
  errors: Array<{ leagueId: string; leagueName: string; error: string }>;
  skipped: Array<{ leagueId: string; leagueName: string; reason: string }>;
};

type LeagueMatchdayTarget = {
  id: string;
  number: number;
  status: MatchdayStatus;
};

/**
 * Batch scores + fantasy fixture results for platform admin.
 *
 * Per league: calculateMatchdayScores then calculateFantasyFixtureResults.
 * Reuses the single-matchday helpers (no long interactive `$transaction`).
 * Incomplete votes / missing lists / published matchdays are skipped, not errors.
 */
export async function calculateAllScoresAndResults(
  options: CalculateAllScoresAndResultsOptions = {}
): Promise<CalculateAllScoresAndResultsResult> {
  const matchdayNumber = options.matchdayNumber;
  const hasExplicitNumber =
    typeof matchdayNumber === "number" &&
    Number.isInteger(matchdayNumber) &&
    matchdayNumber > 0;

  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      matchdays: {
        select: {
          id: true,
          number: true,
          status: true
        },
        orderBy: {
          number: "asc"
        }
      }
    }
  });

  const result: CalculateAllScoresAndResultsResult = {
    calculated: [],
    errors: [],
    skipped: []
  };

  for (const league of leagues) {
    const target = resolveTargetMatchday(league.matchdays, {
      hasExplicitNumber,
      matchdayNumber
    });

    if (!target) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: hasExplicitNumber
          ? `giornata ${matchdayNumber} assente`
          : "nessuna giornata utile"
      });
      continue;
    }

    if (
      target.status === MatchdayStatus.PUBLISHED ||
      target.status === MatchdayStatus.LOCKED
    ) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${target.number}: già pubblicata/chiusa (${target.status})`
      });
      continue;
    }

    const readiness = await getMatchdayScoreReadiness(target.id);
    if (!readiness.ready) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${target.number}: ${readiness.reason}`
      });
      continue;
    }

    try {
      const scores = await calculateMatchdayScores(target.id);
      const fixtures = await calculateFantasyFixtureResults(target.id);

      result.calculated.push({
        fixturesCalculated: fixtures.calculatedCount,
        leagueId: league.id,
        leagueName: league.name,
        matchdayId: target.id,
        matchdayNumber: target.number,
        teamsScored: scores.teamsScored.length
      });
    } catch (error) {
      result.errors.push({
        leagueId: league.id,
        leagueName: league.name,
        error:
          error instanceof Error
            ? error.message
            : "Calcolo punteggi/risultati non riuscito."
      });
    }
  }

  return result;
}

function resolveTargetMatchday(
  matchdays: LeagueMatchdayTarget[],
  options: { hasExplicitNumber: boolean; matchdayNumber?: number }
): LeagueMatchdayTarget | null {
  if (options.hasExplicitNumber && typeof options.matchdayNumber === "number") {
    return (
      matchdays.find((matchday) => matchday.number === options.matchdayNumber) ??
      null
    );
  }

  return getNextUsefulMatchday(matchdays);
}

async function getMatchdayScoreReadiness(matchdayId: string): Promise<
  | { ready: true }
  | { ready: false; reason: string }
> {
  const requiredVotes = await prisma.requiredVotePlayer.findMany({
    where: { matchdayId },
    select: { status: true }
  });

  if (requiredVotes.length === 0) {
    return { ready: false, reason: "liste voti mancanti" };
  }

  const missingCount = requiredVotes.filter(
    (requiredVote) => !isRequiredVoteCompletedStatus(requiredVote.status)
  ).length;

  if (missingCount > 0) {
    return {
      ready: false,
      reason: `voti incompleti (${missingCount} mancanti)`
    };
  }

  return { ready: true };
}

export function formatCalculateAllScoresAndResultsNotice(
  summary: CalculateAllScoresAndResultsResult
): string {
  const ok = summary.calculated.length;
  const skipped = summary.skipped.length;
  const errors = summary.errors.length;

  if (ok === 0 && skipped === 0 && errors === 0) {
    return "Nessuna lega trovata.";
  }

  const parts = [
    `Punteggi e risultati: ${ok} leghe ok`,
    `${skipped} saltate`,
    `${errors} errori`
  ];

  const details: string[] = [];

  if (skipped > 0) {
    const preview = summary.skipped
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.reason}`)
      .join(" | ");
    details.push(`${preview}${skipped > 3 ? "…" : ""}`);
  }

  if (errors > 0) {
    const preview = summary.errors
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.error}`)
      .join(" | ");
    details.push(`${preview}${errors > 3 ? "…" : ""}`);
  }

  if (details.length === 0) {
    return `${parts.join(", ")}.`;
  }

  return `${parts.join(", ")}. ${details.join(" · ")}`;
}
