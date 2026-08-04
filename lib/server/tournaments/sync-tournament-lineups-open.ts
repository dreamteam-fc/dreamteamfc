import { TournamentRoundLineupsStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";

/**
 * Keep `Tournament.lineupsOpen` in sync with any OPEN leg status
 * (denormalized for public lists / legacy reads).
 */
export async function syncTournamentLineupsOpenFlag(tournamentId: string) {
  const openRound = await prisma.tournamentRound.findFirst({
    where: {
      tournamentId,
      OR: [
        { lineupsStatusLeg1: TournamentRoundLineupsStatus.OPEN },
        { lineupsStatusLeg2: TournamentRoundLineupsStatus.OPEN }
      ]
    },
    select: { id: true }
  });

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { lineupsOpen: Boolean(openRound) }
  });

  return { lineupsOpen: Boolean(openRound) };
}
