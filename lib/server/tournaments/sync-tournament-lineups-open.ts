import { TournamentRoundLineupsStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";

/**
 * Keep `Tournament.lineupsOpen` in sync with per-round OPEN status
 * (denormalized for public lists / legacy reads).
 */
export async function syncTournamentLineupsOpenFlag(tournamentId: string) {
  const openRound = await prisma.tournamentRound.findFirst({
    where: {
      tournamentId,
      lineupsStatus: TournamentRoundLineupsStatus.OPEN
    },
    select: { id: true }
  });

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { lineupsOpen: Boolean(openRound) }
  });

  return { lineupsOpen: Boolean(openRound) };
}
