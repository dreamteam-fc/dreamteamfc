import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { autoCarryMissingMatchdayLineups } from "./auto-carry-matchday-lineups.ts";

export type LockMatchdayLineupsResult = {
  autoCarriedCount: number;
  leagueId: string;
  matchdayId: string;
  matchdayNumber: number;
  stillMissingCount: number;
};

/**
 * Close (lock) lineups for a single matchday: LINEUPS_OPEN → LINEUPS_LOCKED.
 * Before locking, auto-carries missing lineups from the last USER lineup in the league.
 * Teams with nothing to copy remain without lineup → forfeit at score time.
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
      status: true
    }
  });

  if (!matchday) {
    throw new Error("Giornata non trovata.");
  }

  if (matchday.status !== MatchdayStatus.LINEUPS_OPEN) {
    throw new Error("Puoi chiudere le formazioni solo da stato LINEUPS_OPEN.");
  }

  const carry = await autoCarryMissingMatchdayLineups(matchday.id);

  await prisma.matchday.update({
    where: {
      id: matchday.id
    },
    data: {
      status: MatchdayStatus.LINEUPS_LOCKED
    }
  });

  return {
    autoCarriedCount: carry.carried,
    leagueId: matchday.leagueId,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number,
    stillMissingCount: carry.stillMissing
  };
}
