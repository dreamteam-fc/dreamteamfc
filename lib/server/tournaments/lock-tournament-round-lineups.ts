import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { syncTournamentLineupsOpenFlag } from "@/lib/server/tournaments/sync-tournament-lineups-open.ts";

export type LockTournamentRoundLineupsResult = {
  roundId: string;
  roundName: string;
  tournamentId: string;
};

/**
 * Close lineups for a tournament round: OPEN → LOCKED.
 * After lock, admin can generate vote lists / import XLS / calculate.
 */
export async function lockTournamentRoundLineups(
  roundId: string
): Promise<LockTournamentRoundLineupsResult> {
  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      lineupsStatus: true,
      tournamentId: true,
      fixtures: {
        where: { status: TournamentFixtureStatus.READY },
        select: {
          id: true,
          _count: {
            select: { lineups: true }
          }
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  if (round.lineupsStatus !== TournamentRoundLineupsStatus.OPEN) {
    throw new Error("Puoi chiudere le formazioni solo da stato OPEN.");
  }

  const submittedLineups = round.fixtures.reduce(
    (total, fixture) => total + fixture._count.lineups,
    0
  );

  if (submittedLineups === 0) {
    throw new Error(
      "Non puoi chiudere le formazioni: nessuna formazione inserita sulle partite READY."
    );
  }

  await prisma.tournamentRound.update({
    where: { id: round.id },
    data: { lineupsStatus: TournamentRoundLineupsStatus.LOCKED }
  });

  await syncTournamentLineupsOpenFlag(round.tournamentId);

  return {
    roundId: round.id,
    roundName: round.name,
    tournamentId: round.tournamentId
  };
}
