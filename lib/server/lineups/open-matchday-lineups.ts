import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type OpenMatchdayLineupsResult = {
  leagueId: string;
  matchdayId: string;
  matchdayNumber: number;
};

/**
 * Open lineups for a single matchday: DRAFT → LINEUPS_OPEN.
 * Reopening from LINEUPS_LOCKED is not allowed.
 */
export async function openMatchdayLineups(
  matchdayId: string
): Promise<OpenMatchdayLineupsResult> {
  const matchday = await prisma.matchday.findUnique({
    where: {
      id: matchdayId
    },
    select: {
      id: true,
      leagueId: true,
      number: true,
      status: true
    }
  });

  if (!matchday) {
    throw new Error("Giornata non trovata.");
  }

  if (matchday.status !== MatchdayStatus.DRAFT) {
    throw new Error("Puoi aprire le formazioni solo da stato DRAFT.");
  }

  await prisma.matchday.update({
    where: {
      id: matchday.id
    },
    data: {
      status: MatchdayStatus.LINEUPS_OPEN
    }
  });

  return {
    leagueId: matchday.leagueId,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number
  };
}
