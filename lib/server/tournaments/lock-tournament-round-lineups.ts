import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
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
  leg: TournamentVoteLeg;
  giornataLabel: string;
  roundId: string;
  roundName: string;
  tournamentId: string;
};

/**
 * Close lineups for one leg (giornata): OPEN → LOCKED.
 * After lock, admin can generate vote lists / import XLS / calculate for that leg.
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

  if (round.isFinal && leg !== 1) {
    throw new Error("La finale ha solo l'andata (leg 1).");
  }

  const currentStatus = getTournamentRoundLineupsStatusForLeg(round, leg);
  if (currentStatus !== TournamentRoundLineupsStatus.OPEN) {
    throw new Error(
      `Puoi chiudere le formazioni di ${tournamentLegLabel(leg).toLowerCase()} solo da stato OPEN.`
    );
  }

  const submittedLineups = round.fixtures.reduce(
    (total, fixture) => total + fixture._count.lineups,
    0
  );

  if (submittedLineups === 0) {
    throw new Error(
      `Non puoi chiudere le formazioni di ${tournamentLegLabel(leg).toLowerCase()}: nessuna formazione inserita sulle partite READY.`
    );
  }

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
    leg,
    giornataLabel,
    roundId: round.id,
    roundName: round.name,
    tournamentId: round.tournamentId
  };
}
