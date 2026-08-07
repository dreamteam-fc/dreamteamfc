import { LineupSource, LineupStatus, SlotType } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type AutoCarryMatchdayLineupsResult = {
  carried: number;
  matchdayId: string;
  stillMissing: number;
};

/**
 * At lineup lock: for each fixture side without a lineup, copy the team's
 * most recent USER-sourced lineup in the same league (earlier matchday number).
 * Players no longer on the roster stay in the XI but score as SV at calculation.
 */
export async function autoCarryMissingMatchdayLineups(
  matchdayId: string
): Promise<AutoCarryMatchdayLineupsResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    select: {
      id: true,
      leagueId: true,
      number: true,
      fixtures: {
        select: {
          awayTeamId: true,
          homeTeamId: true
        }
      },
      lineups: {
        select: {
          fantasyTeamId: true
        }
      }
    }
  });

  if (!matchday) {
    throw new Error("Giornata non trovata.");
  }

  const teamIds = new Set<string>();
  for (const fixture of matchday.fixtures) {
    teamIds.add(fixture.homeTeamId);
    teamIds.add(fixture.awayTeamId);
  }

  const haveLineup = new Set(
    matchday.lineups.map((lineup) => lineup.fantasyTeamId)
  );
  const missingTeamIds = [...teamIds].filter((id) => !haveLineup.has(id));

  if (missingTeamIds.length === 0) {
    return { carried: 0, matchdayId, stillMissing: 0 };
  }

  let carried = 0;

  for (const fantasyTeamId of missingTeamIds) {
    const previous = await prisma.lineup.findFirst({
      where: {
        fantasyTeamId,
        source: LineupSource.USER,
        matchday: {
          leagueId: matchday.leagueId,
          number: { lt: matchday.number }
        },
        players: { some: {} }
      },
      orderBy: {
        matchday: { number: "desc" }
      },
      include: {
        players: {
          select: {
            playerId: true,
            positionOrder: true,
            slotType: true
          }
        }
      }
    });

    if (!previous || previous.players.length === 0) {
      continue;
    }

    await prisma.lineup.create({
      data: {
        fantasyTeamId,
        matchdayId: matchday.id,
        source: LineupSource.AUTO_CARRIED,
        status: LineupStatus.SUBMITTED,
        submittedAt: new Date(),
        players: {
          create: previous.players.map((player) => ({
            playerId: player.playerId,
            positionOrder: player.positionOrder,
            slotType: player.slotType as SlotType
          }))
        }
      }
    });

    carried += 1;
  }

  return {
    carried,
    matchdayId,
    stillMissing: missingTeamIds.length - carried
  };
}
