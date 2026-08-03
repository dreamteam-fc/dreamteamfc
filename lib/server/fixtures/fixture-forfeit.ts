export type FixtureForfeitOutcome =
  | "DOUBLE_FORFEIT"
  | "HOME_WIN_BY_FORFEIT"
  | "NONE"
  | "AWAY_WIN_BY_FORFEIT";

/**
 * Forfeit is derived from TeamScore presence for each side.
 *
 * Important: FantasyFixture.homeTeamScoreId / awayTeamScoreId are only written
 * when fixture results are calculated. Before that step, callers must resolve
 * score ids from Matchday.teamScores by fantasyTeamId — otherwise every
 * SCHEDULED fixture looks like a double forfeit even when lineups/scores exist.
 */
export function getFixtureForfeitOutcome(input: {
  awayTeamScoreId: string | null;
  homeTeamScoreId: string | null;
}): FixtureForfeitOutcome {
  const hasHomeScore = input.homeTeamScoreId !== null;
  const hasAwayScore = input.awayTeamScoreId !== null;

  if (hasHomeScore && hasAwayScore) {
    return "NONE";
  }

  if (hasHomeScore && !hasAwayScore) {
    return "HOME_WIN_BY_FORFEIT";
  }

  if (!hasHomeScore && hasAwayScore) {
    return "AWAY_WIN_BY_FORFEIT";
  }

  return "DOUBLE_FORFEIT";
}

export function getFixtureAdminNote(outcome: FixtureForfeitOutcome) {
  switch (outcome) {
    case "HOME_WIN_BY_FORFEIT":
      return "Vittoria a tavolino: formazione non inserita dalla squadra ospite.";
    case "AWAY_WIN_BY_FORFEIT":
      return "Vittoria a tavolino: formazione non inserita dalla squadra di casa.";
    case "DOUBLE_FORFEIT":
      return "Formazione non inserita da entrambe le squadre.";
    default:
      return null;
  }
}

/**
 * Resolve the TeamScore to show / use for forfeit before fixture results link
 * scores onto FantasyFixture rows.
 */
export function resolveFixtureSideScore<T extends { id: string }>(input: {
  linkedScore: T | null | undefined;
  teamId: string;
  teamScoresByTeamId: Map<string, T>;
}): T | null {
  return input.linkedScore ?? input.teamScoresByTeamId.get(input.teamId) ?? null;
}

/**
 * Forfeit notes are only meaningful once TeamScores for the matchday exist
 * (or the fixture already has calculated/published results with linked scores).
 */
export function shouldShowFixtureForfeitNote(input: {
  fixtureStatus: string;
  matchdayHasTeamScores: boolean;
}): boolean {
  if (
    input.fixtureStatus === "CALCULATED" ||
    input.fixtureStatus === "PUBLISHED"
  ) {
    return true;
  }

  return input.matchdayHasTeamScores;
}
