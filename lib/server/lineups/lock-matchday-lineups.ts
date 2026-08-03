import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type LockMatchdayLineupsResult = {
  leagueId: string;
  matchdayId: string;
  matchdayNumber: number;
};

/**
 * Close (lock) lineups for a single matchday: LINEUPS_OPEN → LINEUPS_LOCKED.
 * Requires at least one lineup already submitted.
 */
export async function lockMatchdayLineups(
  matchdayId: string
): Promise<LockMatchdayLineupsResult> {
  const matchday = await prisma.matchday.findUnique({
    where: {
      id: matchdayId
    },
    select: {
      id: true,
      leagueId: true,
      number: true,
      status: true,
      _count: {
        select: {
          lineups: true
        }
      }
    }
  });

  if (!matchday) {
    throw new Error("Giornata non trovata.");
  }

  if (matchday.status !== MatchdayStatus.LINEUPS_OPEN) {
    throw new Error("Puoi chiudere le formazioni solo da stato LINEUPS_OPEN.");
  }

  if (matchday._count.lineups === 0) {
    throw new Error(
      "Non puoi chiudere le formazioni: nessuna formazione inserita."
    );
  }

  await prisma.matchday.update({
    where: {
      id: matchday.id
    },
    data: {
      status: MatchdayStatus.LINEUPS_LOCKED
    }
  });

  return {
    leagueId: matchday.leagueId,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number
  };
}
