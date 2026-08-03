import {
  TournamentFixtureStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";

type UsefulRoundFixture = {
  awayTeamId: string | null;
  homeTeamId: string | null;
  status: TournamentFixtureStatus;
};

/**
 * Next useful tournament round: prefer OPEN with READY fixtures, else the first
 * DRAFT/OPEN round (by roundIndex) that already has READY home+away fixtures.
 * LOCKED / completed phases are skipped — same spirit as getNextUsefulMatchday.
 */
export function getNextUsefulTournamentRound<
  T extends {
    fixtures: readonly UsefulRoundFixture[];
    lineupsStatus: TournamentRoundLineupsStatus;
    roundIndex: number;
  }
>(rounds: readonly T[]): T | null {
  const ordered = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const withReady = ordered.filter(
    (round) =>
      round.lineupsStatus !== TournamentRoundLineupsStatus.LOCKED &&
      countReadyPlayableFixtures(round.fixtures) > 0
  );

  return (
    withReady.find(
      (round) => round.lineupsStatus === TournamentRoundLineupsStatus.OPEN
    ) ??
    withReady[0] ??
    null
  );
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
