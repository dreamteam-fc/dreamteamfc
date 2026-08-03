import { FantasyFixtureStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { convertScoreToGoals } from "../../scoring/convert-score-to-goals.ts";
import { getFixtureForfeitOutcome } from "./fixture-forfeit.ts";
import { prismaDecimalToNumber } from "../votes/shared.ts";

export type CalculateFantasyFixtureResultsResult = {
  calculatedCount: number;
  matchdayId: string;
  results: Array<{
    awayGoals: number;
    awayTeamId: string;
    fixtureId: string;
    homeGoals: number;
    homeTeamId: string;
  }>;
  totalFixtures: number;
};

type FixtureResultWrite = {
  awayGoals: number;
  awayTeamId: string;
  awayTeamScoreId: string | null;
  fixtureId: string;
  homeGoals: number;
  homeTeamId: string;
  homeTeamScoreId: string | null;
};

/**
 * Convert calculated TeamScores into fantasy fixture goals.
 *
 * Intentionally avoids interactive `$transaction`: Supabase PgBouncer drops
 * long Prisma interactive txs mid-flight with "Transaction not found...".
 * Precompute outcomes in memory, then write plain updates (no interactive tx
 * spanning every fixture).
 */
export async function calculateFantasyFixtureResults(
  matchdayId: string
): Promise<CalculateFantasyFixtureResultsResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    select: {
      id: true
    }
  });

  if (!matchday) {
    throw new Error(`Matchday ${matchdayId} not found.`);
  }

  const fixtures = await prisma.fantasyFixture.findMany({
    where: { matchdayId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      awayTeamId: true,
      homeTeamId: true,
      id: true
    }
  });

  if (fixtures.length === 0) {
    throw new Error(`No fantasy fixtures found for matchday ${matchdayId}.`);
  }

  const teamScores = await prisma.teamScore.findMany({
    where: { matchdayId },
    select: {
      fantasyTeamId: true,
      id: true,
      totalScore: true
    }
  });

  const scoreByFantasyTeamId = new Map(
    teamScores.map((teamScore) => [teamScore.fantasyTeamId, teamScore])
  );

  const writes: FixtureResultWrite[] = fixtures.map((fixture) => {
    const homeTeamScore = scoreByFantasyTeamId.get(fixture.homeTeamId);
    const awayTeamScore = scoreByFantasyTeamId.get(fixture.awayTeamId);
    const forfeitOutcome = getFixtureForfeitOutcome({
      awayTeamScoreId: awayTeamScore?.id ?? null,
      homeTeamScoreId: homeTeamScore?.id ?? null
    });

    let homeGoals = 0;
    let awayGoals = 0;

    if (forfeitOutcome === "NONE") {
      const homeTotalScore = prismaDecimalToNumber(
        homeTeamScore?.totalScore ?? null
      );
      const awayTotalScore = prismaDecimalToNumber(
        awayTeamScore?.totalScore ?? null
      );

      if (homeTotalScore === null) {
        throw new Error(
          `TeamScore ${homeTeamScore?.id ?? "unknown"} has null totalScore and cannot be converted to goals.`
        );
      }

      if (awayTotalScore === null) {
        throw new Error(
          `TeamScore ${awayTeamScore?.id ?? "unknown"} has null totalScore and cannot be converted to goals.`
        );
      }

      homeGoals = convertScoreToGoals(homeTotalScore);
      awayGoals = convertScoreToGoals(awayTotalScore);
    } else if (forfeitOutcome === "HOME_WIN_BY_FORFEIT") {
      homeGoals = 3;
      awayGoals = 0;
    } else if (forfeitOutcome === "AWAY_WIN_BY_FORFEIT") {
      homeGoals = 0;
      awayGoals = 3;
    }

    return {
      awayGoals,
      awayTeamId: fixture.awayTeamId,
      awayTeamScoreId: awayTeamScore?.id ?? null,
      fixtureId: fixture.id,
      homeGoals,
      homeTeamId: fixture.homeTeamId,
      homeTeamScoreId: homeTeamScore?.id ?? null
    };
  });

  for (const write of writes) {
    await prisma.fantasyFixture.update({
      where: {
        id: write.fixtureId
      },
      data: {
        awayGoals: write.awayGoals,
        awayTeamScoreId: write.awayTeamScoreId,
        homeGoals: write.homeGoals,
        homeTeamScoreId: write.homeTeamScoreId,
        status: FantasyFixtureStatus.CALCULATED
      }
    });
  }

  return {
    calculatedCount: writes.length,
    matchdayId,
    results: writes.map((write) => ({
      awayGoals: write.awayGoals,
      awayTeamId: write.awayTeamId,
      fixtureId: write.fixtureId,
      homeGoals: write.homeGoals,
      homeTeamId: write.homeTeamId
    })),
    totalFixtures: fixtures.length
  };
}
