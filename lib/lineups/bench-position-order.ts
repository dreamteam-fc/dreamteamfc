import { PlayerRole } from "@prisma/client";

/**
 * Stable DB `positionOrder` for bench slots (exactly 1 player per role).
 * Not a user-facing substitution priority: auto-subs match by role only.
 */
export const BENCH_POSITION_ORDER_BY_ROLE: Record<PlayerRole, number> = {
  [PlayerRole.GOALKEEPER]: 1,
  [PlayerRole.DEFENDER]: 2,
  [PlayerRole.MIDFIELDER]: 3,
  [PlayerRole.ATTACKER]: 4
};

export function getBenchPositionOrderByRole(role: PlayerRole): number {
  return BENCH_POSITION_ORDER_BY_ROLE[role];
}
