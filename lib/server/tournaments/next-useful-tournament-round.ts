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
 * Next useful tournament round for admin lineup actions.
 * Prefer OPEN with READY fixtures, then any OPEN phase (so Genera stays visible
 * while Formazioni are aperte), else the first DRAFT round with READY fixtures.
 * LOCKED phases are skipped — same spirit as getNextUsefulMatchday.
 */
export function getNextUsefulTournamentRound<
  T extends {
    fixtures: readonly UsefulRoundFixture[];
    lineupsStatus: TournamentRoundLineupsStatus;
    roundIndex: number;
  }
>(rounds: readonly T[]): T | null {
  const ordered = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const openRounds = ordered.filter(
    (round) => round.lineupsStatus === TournamentRoundLineupsStatus.OPEN
  );
  const openWithReady = openRounds.find(
    (round) => countReadyPlayableFixtures(round.fixtures) > 0
  );
  if (openWithReady) {
    return openWithReady;
  }
  if (openRounds[0]) {
    return openRounds[0];
  }

  return (
    ordered.find(
      (round) =>
        round.lineupsStatus !== TournamentRoundLineupsStatus.LOCKED &&
        countReadyPlayableFixtures(round.fixtures) > 0
    ) ?? null
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
