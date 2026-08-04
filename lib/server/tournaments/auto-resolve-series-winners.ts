import { TournamentFixtureStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { applySeriesWinner } from "@/lib/server/tournaments/record-tournament-result.ts";
import { prismaDecimalToNumber } from "@/lib/server/votes/shared.ts";
import { resolveSeriesWinner } from "@/lib/tournaments/resolve-series-winner.ts";

/**
 * For completed series still missing seriesWinnerTeamId, apply rules 1–4.
 * Leaves true ties unresolved for admin pick.
 */
export async function autoResolveCompletedSeriesWinners(
  tournamentId: string
): Promise<{ advanced: number; stillTied: number }> {
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    select: {
      id: true,
      isFinal: true,
      fixtures: {
        select: {
          awayFantapunti: true,
          awayGoals: true,
          awayTeamId: true,
          homeFantapunti: true,
          homeGoals: true,
          homeTeamId: true,
          leg: true,
          seriesKey: true,
          seriesWinnerTeamId: true,
          status: true
        }
      }
    }
  });

  const entries = await prisma.tournamentTeamEntry.findMany({
    where: { tournamentId },
    select: {
      fantasyTeamId: true,
      seedFantapunti: true,
      seedPoints: true
    }
  });
  const seedByTeamId = new Map(
    entries.map((entry) => [
      entry.fantasyTeamId,
      {
        seedFantapunti: prismaDecimalToNumber(entry.seedFantapunti) ?? 0,
        seedPoints: entry.seedPoints
      }
    ])
  );

  let advanced = 0;
  let stillTied = 0;

  for (const round of rounds) {
    const bySeries = new Map<string, (typeof round.fixtures)[number][]>();
    for (const fixture of round.fixtures) {
      const list = bySeries.get(fixture.seriesKey) ?? [];
      list.push(fixture);
      bySeries.set(fixture.seriesKey, list);
    }

    const expectedLegs = round.isFinal ? 1 : 2;

    for (const [seriesKey, fixtures] of bySeries) {
      if (fixtures.length !== expectedLegs) {
        continue;
      }
      if (fixtures.some((fixture) => fixture.seriesWinnerTeamId != null)) {
        continue;
      }
      if (
        fixtures.some(
          (fixture) =>
            fixture.status !== TournamentFixtureStatus.COMPLETED ||
            fixture.homeGoals == null ||
            fixture.awayGoals == null ||
            !fixture.homeTeamId ||
            !fixture.awayTeamId
        )
      ) {
        continue;
      }

      const resolved = resolveSeriesWinner({
        fixtures: fixtures.map((fixture) => ({
          awayFantapunti: prismaDecimalToNumber(fixture.awayFantapunti),
          awayGoals: fixture.awayGoals,
          awayTeamId: fixture.awayTeamId,
          homeFantapunti: prismaDecimalToNumber(fixture.homeFantapunti),
          homeGoals: fixture.homeGoals,
          homeTeamId: fixture.homeTeamId,
          leg: fixture.leg
        })),
        seedByTeamId
      });

      if (resolved.kind === "tied") {
        stillTied += 1;
        continue;
      }

      await applySeriesWinner({
        roundId: round.id,
        seriesKey,
        tournamentId,
        winnerId: resolved.winnerId
      });
      advanced += 1;
    }
  }

  return { advanced, stillTied };
}
