/**
 * League standings order:
 * 1) league points (desc)
 * 2) fantapunti total (desc)
 * 3) goal difference (desc)
 * 4) admin standingsTieBreakRank (asc; lower = better; null = unresolved)
 * 5) team name (stable display only until admin resolves)
 */

export type StandingSortFields = {
  fantasyPointsTotal: number;
  goalDifference: number;
  leaguePoints: number;
  standingsTieBreakRank: number | null;
  teamName: string;
};

/** True when automatic criteria (1–3) are equal. */
export function sameAutoStandingCriteria(
  left: Pick<
    StandingSortFields,
    "fantasyPointsTotal" | "goalDifference" | "leaguePoints"
  >,
  right: Pick<
    StandingSortFields,
    "fantasyPointsTotal" | "goalDifference" | "leaguePoints"
  >
): boolean {
  return (
    left.leaguePoints === right.leaguePoints &&
    left.fantasyPointsTotal === right.fantasyPointsTotal &&
    left.goalDifference === right.goalDifference
  );
}

export function compareLeagueStandingRows(
  left: StandingSortFields,
  right: StandingSortFields
): number {
  if (right.leaguePoints !== left.leaguePoints) {
    return right.leaguePoints - left.leaguePoints;
  }

  if (right.fantasyPointsTotal !== left.fantasyPointsTotal) {
    return right.fantasyPointsTotal - left.fantasyPointsTotal;
  }

  if (right.goalDifference !== left.goalDifference) {
    return right.goalDifference - left.goalDifference;
  }

  const leftRank = left.standingsTieBreakRank;
  const rightRank = right.standingsTieBreakRank;

  if (leftRank != null && rightRank != null && leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (leftRank != null && rightRank == null) {
    return -1;
  }

  if (leftRank == null && rightRank != null) {
    return 1;
  }

  return left.teamName.localeCompare(right.teamName, "it");
}

/** Groups still tied after punti / fantapunti / DR (admin may still need to pick). */
export function findStandingTieGroups<T extends StandingSortFields & { teamId: string }>(
  sortedRows: T[]
): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];

  for (const row of sortedRows) {
    const prev = current[current.length - 1];
    if (!prev || sameAutoStandingCriteria(prev, row)) {
      current.push(row);
      continue;
    }
    if (current.length > 1) {
      groups.push(current);
    }
    current = [row];
  }

  if (current.length > 1) {
    groups.push(current);
  }

  return groups;
}

/** Tie group still needs admin if ranks are missing or not a unique 1..n. */
export function standingTieGroupNeedsAdmin(
  group: Array<Pick<StandingSortFields, "standingsTieBreakRank">>
): boolean {
  if (group.length < 2) {
    return false;
  }

  const ranks = group.map((row) => row.standingsTieBreakRank);
  if (ranks.some((rank) => rank == null)) {
    return true;
  }

  const unique = new Set(ranks);
  if (unique.size !== group.length) {
    return true;
  }

  const expected = new Set(
    Array.from({ length: group.length }, (_, index) => index + 1)
  );
  for (const rank of ranks) {
    if (rank == null || !expected.has(rank)) {
      return true;
    }
  }

  return false;
}
