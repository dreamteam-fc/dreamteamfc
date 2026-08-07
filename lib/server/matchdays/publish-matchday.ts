import {
  FantasyFixtureStatus,
  MatchdayStatus,
  ScoreStatus
} from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type PublishMatchdayResult = {
  fixturesPublished: boolean;
  matchdayId: string;
  publishedAt: Date;
  publishedFixturesCount: number;
  publishedTeamScoresCount: number;
};

export async function publishMatchday(
  matchdayId: string
): Promise<PublishMatchdayResult> {
  return prisma.$transaction(async (tx) => {
    const matchday = await tx.matchday.findUnique({
      where: { id: matchdayId },
      select: {
        id: true,
        status: true
      }
    });

    if (!matchday) {
      throw new Error(`Matchday ${matchdayId} not found.`);
    }

    if (
      matchday.status !== MatchdayStatus.SCORES_CALCULATED &&
      matchday.status !== MatchdayStatus.PUBLISHED
    ) {
      throw new Error(
        `Matchday ${matchdayId} can be published only from SCORES_CALCULATED or PUBLISHED status.`
      );
    }

    const publishedAt = new Date();
    const teamScores = await tx.teamScore.findMany({
      where: {
        matchdayId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (teamScores.length === 0) {
      throw new Error(`Matchday ${matchdayId} has no calculated team scores.`);
    }

    const invalidTeamScore = teamScores.find(
      (teamScore) =>
        teamScore.status !== ScoreStatus.CALCULATED &&
        teamScore.status !== ScoreStatus.PUBLISHED
    );

    if (invalidTeamScore) {
      throw new Error(
        `Matchday ${matchdayId} has team scores that are not publishable.`
      );
    }

    const fixtures = await tx.fantasyFixture.findMany({
      where: {
        matchdayId
      },
      select: {
        id: true,
        status: true
      }
    });

    const invalidFixture = fixtures.find(
      (fixture) =>
        fixture.status !== FantasyFixtureStatus.CALCULATED &&
        fixture.status !== FantasyFixtureStatus.PUBLISHED
    );

    if (invalidFixture) {
      throw new Error(
        `Matchday ${matchdayId} has fantasy fixtures that are not publishable. Expected only CALCULATED or PUBLISHED fixtures. Se gli scontri sono ancora SCHEDULED, calcola prima i risultati (Genera/aggiorna risultati scontri o ricalcola i punteggi).`
      );
    }

    const publishedScores = await tx.teamScore.updateMany({
      where: {
        matchdayId,
        status: {
          not: ScoreStatus.PUBLISHED
        }
      },
      data: {
        publishedAt,
        status: ScoreStatus.PUBLISHED
      }
    });

    let publishedFixturesCount = 0;
    if (fixtures.length > 0) {
      const publishedFixtures = await tx.fantasyFixture.updateMany({
        where: {
          matchdayId,
          status: FantasyFixtureStatus.CALCULATED
        },
        data: {
          status: FantasyFixtureStatus.PUBLISHED
        }
      });
      publishedFixturesCount = publishedFixtures.count;
    }

    await tx.matchday.update({
      where: { id: matchdayId },
      data: {
        status: MatchdayStatus.PUBLISHED
      }
    });

    return {
      fixturesPublished: fixtures.length > 0,
      matchdayId,
      publishedAt,
      publishedFixturesCount,
      publishedTeamScoresCount: publishedScores.count
    };
  });
}
