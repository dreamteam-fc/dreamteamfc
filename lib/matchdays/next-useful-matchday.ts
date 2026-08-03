import { MatchdayStatus } from "@prisma/client";

/** Statuses that mean results are already public / closed for admin workflow. */
const PUBLISHED_LIKE_STATUSES: ReadonlySet<MatchdayStatus> = new Set([
  MatchdayStatus.PUBLISHED,
  MatchdayStatus.LOCKED
]);

/**
 * Next useful matchday: lowest `number` whose status is not yet published
 * (PUBLISHED or LOCKED). When giornata N is published, returns N+1, etc.
 */
export function getNextUsefulMatchday<
  T extends { number: number; status: MatchdayStatus }
>(matchdays: readonly T[]): T | null {
  const ordered = [...matchdays].sort((a, b) => a.number - b.number);
  return (
    ordered.find((matchday) => !PUBLISHED_LIKE_STATUSES.has(matchday.status)) ??
    null
  );
}

export function isMatchdayPublishedLike(status: MatchdayStatus): boolean {
  return PUBLISHED_LIKE_STATUSES.has(status);
}
