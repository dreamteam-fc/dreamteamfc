import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

import {
  getTournamentRoundLineupsStatusForLeg,
  legsForTournamentRound,
  type TournamentVoteLeg
} from "./tournament-round-leg.ts";

type UsefulRoundFixture = {
  awayTeamId: string | null;
  homeTeamId: string | null;
  leg: number;
  status: TournamentFixtureStatus;
};

export type UsefulTournamentLegRef<T> = {
  leg: TournamentVoteLeg;
  round: T;
};

/**
 * Next useful tournament giornata (round + leg) for admin lineup actions.
 * Order: round0 leg1 → round0 leg2 → round1 leg1 → …
 * Prefer OPEN with READY fixtures for that leg, then any OPEN, else first
 * non-LOCKED leg with READY fixtures.
 */
export function getNextUsefulTournamentLeg<
  T extends {
    fixtures: readonly UsefulRoundFixture[];
    isFinal: boolean;
    lineupsStatusLeg1: TournamentRoundLineupsStatus;
    lineupsStatusLeg2: TournamentRoundLineupsStatus;
    roundIndex: number;
  }
>(rounds: readonly T[]): UsefulTournamentLegRef<T> | null {
  const ordered = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const candidates: UsefulTournamentLegRef<T>[] = [];

  for (const round of ordered) {
    for (const leg of legsForTournamentRound(round.isFinal)) {
      candidates.push({ round, leg });
    }
  }

  const openWithReady = candidates.find(
    ({ round, leg }) =>
      getTournamentRoundLineupsStatusForLeg(round, leg) ===
        TournamentRoundLineupsStatus.OPEN &&
      countReadyPlayableFixturesForLeg(round.fixtures, leg) > 0
  );
  if (openWithReady) {
    return openWithReady;
  }

  const anyOpen = candidates.find(
    ({ round, leg }) =>
      getTournamentRoundLineupsStatusForLeg(round, leg) ===
      TournamentRoundLineupsStatus.OPEN
  );
  if (anyOpen) {
    return anyOpen;
  }

  return (
    candidates.find(
      ({ round, leg }) =>
        getTournamentRoundLineupsStatusForLeg(round, leg) !==
          TournamentRoundLineupsStatus.LOCKED &&
        countReadyPlayableFixturesForLeg(round.fixtures, leg) > 0
    ) ?? null
  );
}

/** @deprecated Prefer getNextUsefulTournamentLeg — kept for call-site migration. */
export function getNextUsefulTournamentRound<
  T extends {
    fixtures: readonly UsefulRoundFixture[];
    isFinal: boolean;
    lineupsStatusLeg1: TournamentRoundLineupsStatus;
    lineupsStatusLeg2: TournamentRoundLineupsStatus;
    roundIndex: number;
  }
>(rounds: readonly T[]): T | null {
  return getNextUsefulTournamentLeg(rounds)?.round ?? null;
}

export function countReadyPlayableFixtures(
  fixtures: readonly UsefulRoundFixture[]
): number {
  return fixtures.filter(
    (fixture) =>
      fixture.status === TournamentFixtureStatus.READY &&
      fixture.homeTeamId != null &&
      fixture.awayTeamId != null
  ).length;
}

export function countReadyPlayableFixturesForLeg(
  fixtures: readonly UsefulRoundFixture[],
  leg: TournamentVoteLeg
): number {
  return fixtures.filter(
    (fixture) =>
      fixture.leg === leg &&
      fixture.status === TournamentFixtureStatus.READY &&
      fixture.homeTeamId != null &&
      fixture.awayTeamId != null
  ).length;
}
