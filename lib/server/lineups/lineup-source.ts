import { LineupSource } from "@prisma/client";

import type { TeamAccessRole } from "@/lib/server/teams/team-access.ts";

/** Sources that count as a real submitted lineup for auto-carry. */
export const COPYABLE_LINEUP_SOURCES: LineupSource[] = [
  LineupSource.USER,
  LineupSource.COACH
];

/** Owner/admin → USER; invited coach (allenatore) → COACH (UI: MISTER). */
export function lineupSourceFromAccessRole(
  role: TeamAccessRole | null
): LineupSource {
  return role === "coach" ? LineupSource.COACH : LineupSource.USER;
}
