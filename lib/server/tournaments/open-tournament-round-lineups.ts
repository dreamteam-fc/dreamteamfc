import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { autoResolveCompletedSeriesWinners } from "@/lib/server/tournaments/auto-resolve-series-winners.ts";
import { assertNoPendingTournamentSeriesTies } from "@/lib/server/tournaments/pending-series-ties.ts";
import { syncTournamentLineupsOpenFlag } from "@/lib/server/tournaments/sync-tournament-lineups-open.ts";
import {
  arePriorTournamentLegsLocked,
  assertTournamentLineupLeg,
  getTournamentRoundLineupsStatusForLeg,
  lineupsStatusFieldForLeg,
  tournamentGiornataLabel,
  tournamentLegLabel,
  type TournamentVoteLeg
} from "@/lib/server/tournaments/tournament-round-leg.ts";

export type OpenTournamentRoundLineupsResult = {
  leg: TournamentVoteLeg;
  giornataLabel: string;
  roundId: string;
  roundName: string;
  tournamentId: string;
};

/**
 * Open lineups for one leg (giornata): DRAFT → OPEN.
 * Reopening from LOCKED is not allowed. Prior giornate must be LOCKED.
 */
export async function openTournamentRoundLineups(
  roundId: string,
  leg: number
): Promise<OpenTournamentRoundLineupsResult> {
  assertTournamentLineupLeg(leg);

  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      isFinal: true,
      roundIndex: true,
      lineupsStatusLeg1: true,
      lineupsStatusLeg2: true,
      tournamentId: true,
      tournament: {
        select: {
          status: true,
          rounds: {
            select: {
              isFinal: true,
              lineupsStatusLeg1: true,
              lineupsStatusLeg2: true,
              roundIndex: true
            }
          }
        }
      },
      fixtures: {
        where: {
          status: TournamentFixtureStatus.READY,
          leg
        },
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

  if (round.isFinal && leg !== 1) {
    throw new Error("La finale ha solo l'andata (leg 1).");
  }

  if (
    round.tournament.status !== TournamentStatus.BRACKET_GENERATED &&
    round.tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new Error("Torneo non in fase di formazioni.");
  }

  const currentStatus = getTournamentRoundLineupsStatusForLeg(round, leg);
  if (currentStatus !== TournamentRoundLineupsStatus.DRAFT) {
    throw new Error(
      `Puoi aprire le formazioni di ${tournamentLegLabel(leg).toLowerCase()} solo da stato DRAFT (non dopo la chiusura).`
    );
  }

  if (
    !arePriorTournamentLegsLocked(
      round.tournament.rounds,
      round.roundIndex,
      leg
    )
  ) {
    throw new Error(
      "Chiudi e completa prima la giornata precedente (ordine andata → ritorno → fase successiva)."
    );
  }

  await autoResolveCompletedSeriesWinners(round.tournamentId);
  await assertNoPendingTournamentSeriesTies(round.tournamentId);

  const playableReady = round.fixtures.filter(
    (fixture) => fixture.homeTeamId && fixture.awayTeamId
  );

  if (playableReady.length === 0) {
    throw new Error(
      `Nessuna partita READY con entrambe le squadre per ${tournamentLegLabel(leg).toLowerCase()}.`
    );
  }

  const field = lineupsStatusFieldForLeg(leg);
  await prisma.tournamentRound.update({
    where: { id: round.id },
    data: { [field]: TournamentRoundLineupsStatus.OPEN }
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
