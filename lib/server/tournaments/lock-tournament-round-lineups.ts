import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { autoCarryMissingTournamentRoundLineups } from "@/lib/server/tournaments/auto-carry-tournament-round-lineups.ts";
import { syncTournamentLineupsOpenFlag } from "@/lib/server/tournaments/sync-tournament-lineups-open.ts";
import {
  assertTournamentLineupLeg,
  getTournamentRoundLineupsStatusForLeg,
  lineupsStatusFieldForLeg,
  tournamentGiornataLabel,
  tournamentLegLabel,
  type TournamentVoteLeg
} from "@/lib/server/tournaments/tournament-round-leg.ts";

export type LockTournamentRoundLineupsResult = {
  autoCarriedCount: number;
  leg: TournamentVoteLeg;
  giornataLabel: string;
  roundId: string;
  roundName: string;
  stillMissingCount: number;
  tournamentId: string;
};

/**
 * Close lineups for one leg (giornata): OPEN → LOCKED.
 * Auto-carries missing sides from the last USER lineup in the same tournament.
 */
export async function lockTournamentRoundLineups(
  roundId: string,
  leg: number
): Promise<LockTournamentRoundLineupsResult> {
  assertTournamentLineupLeg(leg);

  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      isFinal: true,
      lineupsStatusLeg1: true,
      lineupsStatusLeg2: true,
      tournamentId: true,
      fixtures: {
        where: {
          status: TournamentFixtureStatus.READY,
          leg
        },
        select: {
          id: true
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  if (round.isFinal && leg !== 1) {
    throw new Error("La finale ha solo l'andata (leg 1).");
  }

  const currentStatus = getTournamentRoundLineupsStatusForLeg(round, leg);
  if (currentStatus !== TournamentRoundLineupsStatus.OPEN) {
    throw new Error(
      `Puoi chiudere le formazioni di ${tournamentLegLabel(leg).toLowerCase()} solo da stato OPEN.`
    );
  }

  if (round.fixtures.length === 0) {
    throw new Error(
      `Non ci sono partite READY per chiudere le formazioni di ${tournamentLegLabel(leg).toLowerCase()}.`
    );
  }

  const carry = await autoCarryMissingTournamentRoundLineups(round.id, leg);

  const field = lineupsStatusFieldForLeg(leg);
  await prisma.tournamentRound.update({
    where: { id: round.id },
    data: { [field]: TournamentRoundLineupsStatus.LOCKED }
  });

  await syncTournamentLineupsOpenFlag(round.tournamentId);

  const giornataLabel = tournamentGiornataLabel({
    isFinal: round.isFinal,
    leg,
    roundName: round.name
  });

  return {
    autoCarriedCount: carry.carried,
    leg,
    giornataLabel,
    roundId: round.id,
    roundName: round.name,
    stillMissingCount: carry.stillMissing,
    tournamentId: round.tournamentId
  };
}
