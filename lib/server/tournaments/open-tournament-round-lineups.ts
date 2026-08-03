import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { syncTournamentLineupsOpenFlag } from "@/lib/server/tournaments/sync-tournament-lineups-open.ts";

export type OpenTournamentRoundLineupsResult = {
  roundId: string;
  roundName: string;
  tournamentId: string;
};

/**
 * Open lineups for a tournament round: DRAFT → OPEN.
 * Reopening from LOCKED is not allowed (same as league matchdays).
 */
export async function openTournamentRoundLineups(
  roundId: string
): Promise<OpenTournamentRoundLineupsResult> {
  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      lineupsStatus: true,
      tournamentId: true,
      tournament: {
        select: { status: true }
      },
      fixtures: {
        where: { status: TournamentFixtureStatus.READY },
        select: {
          id: true,
          homeTeamId: true,
          awayTeamId: true
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  if (
    round.tournament.status !== TournamentStatus.BRACKET_GENERATED &&
    round.tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new Error("Torneo non in fase di formazioni.");
  }

  if (round.lineupsStatus !== TournamentRoundLineupsStatus.DRAFT) {
    throw new Error(
      "Puoi aprire le formazioni solo da stato DRAFT (non dopo la chiusura)."
    );
  }

  const playableReady = round.fixtures.filter(
    (fixture) => fixture.homeTeamId && fixture.awayTeamId
  );

  if (playableReady.length === 0) {
    throw new Error(
      "Nessuna partita READY con entrambe le squadre in questa fase."
    );
  }

  await prisma.tournamentRound.update({
    where: { id: round.id },
    data: { lineupsStatus: TournamentRoundLineupsStatus.OPEN }
  });

  await syncTournamentLineupsOpenFlag(round.tournamentId);

  return {
    roundId: round.id,
    roundName: round.name,
    tournamentId: round.tournamentId
  };
}
