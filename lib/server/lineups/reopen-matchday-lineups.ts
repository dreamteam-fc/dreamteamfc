import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type ReopenMatchdayLineupsResult = {
  leagueId: string;
  matchdayId: string;
  matchdayNumber: number;
};

/**
 * Controlled rollback of lineup status only: LINEUPS_LOCKED → LINEUPS_OPEN.
 * Does not delete lineups, votes, scores, fixtures, or standings.
 */
export async function reopenMatchdayLineups(
  matchdayId: string
): Promise<ReopenMatchdayLineupsResult> {
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

  if (matchday.status !== MatchdayStatus.LINEUPS_LOCKED) {
    throw new Error(
      "Le formazioni possono essere riaperte solo se la giornata è chiusa e non è ancora iniziata la fase voti."
    );
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
