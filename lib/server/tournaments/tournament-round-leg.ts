import { TournamentRoundLineupsStatus } from "@prisma/client";

export type TournamentVoteLeg = 1 | 2;

export function assertTournamentLineupLeg(
  leg: number
): asserts leg is TournamentVoteLeg {
  if (leg !== 1 && leg !== 2) {
    throw new Error("Gamba non valida: usa 1 (andata) o 2 (ritorno).");
  }
}

export function tournamentLegLabel(leg: number): string {
  return leg === 2 ? "Ritorno" : "Andata";
}

export function tournamentGiornataLabel(options: {
  isFinal: boolean;
  leg: number;
  roundName: string;
}): string {
  if (options.isFinal) {
    return `${options.roundName} — Partita unica`;
  }
  return `${options.roundName} — ${tournamentLegLabel(options.leg)}`;
}

export function lineupsStatusFieldForLeg(
  leg: TournamentVoteLeg
): "lineupsStatusLeg1" | "lineupsStatusLeg2" {
  return leg === 2 ? "lineupsStatusLeg2" : "lineupsStatusLeg1";
}

export function getTournamentRoundLineupsStatusForLeg(
  round: {
    lineupsStatusLeg1: TournamentRoundLineupsStatus;
    lineupsStatusLeg2: TournamentRoundLineupsStatus;
  },
  leg: TournamentVoteLeg
): TournamentRoundLineupsStatus {
  return leg === 2 ? round.lineupsStatusLeg2 : round.lineupsStatusLeg1;
}

export function roundHasOpenLineupsLeg(round: {
  lineupsStatusLeg1: TournamentRoundLineupsStatus;
  lineupsStatusLeg2: TournamentRoundLineupsStatus;
}): boolean {
  return (
    round.lineupsStatusLeg1 === TournamentRoundLineupsStatus.OPEN ||
    round.lineupsStatusLeg2 === TournamentRoundLineupsStatus.OPEN
  );
}

/** Legs that exist for a round (finale = only andata). */
export function legsForTournamentRound(isFinal: boolean): TournamentVoteLeg[] {
  return isFinal ? [1] : [1, 2];
}

/**
 * True when every giornata before (roundIndex, leg) is LOCKED.
 * Order: round0 leg1 → round0 leg2 → round1 leg1 → …
 */
export function arePriorTournamentLegsLocked<
  T extends {
    isFinal: boolean;
    lineupsStatusLeg1: TournamentRoundLineupsStatus;
    lineupsStatusLeg2: TournamentRoundLineupsStatus;
    roundIndex: number;
  }
>(
  rounds: readonly T[],
  targetRoundIndex: number,
  targetLeg: TournamentVoteLeg
): boolean {
  const ordered = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);

  for (const round of ordered) {
    if (round.roundIndex > targetRoundIndex) {
      break;
    }

    const legs = legsForTournamentRound(round.isFinal);

    for (const leg of legs) {
      if (
        round.roundIndex === targetRoundIndex &&
        leg === targetLeg
      ) {
        return true;
      }

      const status = getTournamentRoundLineupsStatusForLeg(round, leg);
      if (status !== TournamentRoundLineupsStatus.LOCKED) {
        return false;
      }
    }
  }

  return true;
}
