/**
 * Penalties when a team has no user-submitted lineup at lock time.
 *
 * - AUTO_CARRIED lineup: −2 fantapunti (before goals, floored at 0) + −1 league points
 * - No copyable USER/COACH lineup: forfeit 3–0 (no fantapunti) + −1 league points
 * - Tournament: same fantapunti/forfeit rules, no league-points penalty
 */

export const AUTO_LINEUP_FANTAPUNTI_PENALTY = 2;
export const AUTO_LINEUP_LEAGUE_POINTS_PENALTY = 1;

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Apply −2 fantapunti before goal conversion; never below 0. */
export function applyFantapuntiPenalty(
  grossScore: number,
  shouldApply: boolean
): { fantapuntiPenalty: number; netScore: number } {
  if (!shouldApply) {
    return { fantapuntiPenalty: 0, netScore: roundToTwoDecimals(grossScore) };
  }

  return {
    fantapuntiPenalty: AUTO_LINEUP_FANTAPUNTI_PENALTY,
    netScore: Math.max(
      0,
      roundToTwoDecimals(grossScore - AUTO_LINEUP_FANTAPUNTI_PENALTY)
    )
  };
}
