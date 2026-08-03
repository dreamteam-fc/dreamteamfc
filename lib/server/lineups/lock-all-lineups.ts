import { MatchdayStatus } from "@prisma/client";

import { getNextUsefulMatchday } from "../../matchdays/next-useful-matchday.ts";
import { prisma } from "../../prisma.ts";
import {
  lockMatchdayLineups,
  type LockMatchdayLineupsResult
} from "./lock-matchday-lineups.ts";

export type LockAllLineupsResult = {
  errors: Array<{ leagueId: string; leagueName: string; error: string }>;
  locked: Array<{
    leagueId: string;
    leagueName: string;
    result: LockMatchdayLineupsResult;
  }>;
  skipped: Array<{ leagueId: string; leagueName: string; reason: string }>;
};

/**
 * Batch lineup lock for platform admin.
 *
 * For each league, targets the next useful matchday (same spirit as the admin
 * dashboard / random-lineups batch). Locks only when status is LINEUPS_OPEN.
 */
export async function lockAllLineups(): Promise<LockAllLineupsResult> {
  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      matchdays: {
        select: {
          id: true,
          number: true,
          status: true
        },
        orderBy: {
          number: "asc"
        }
      }
    }
  });

  const result: LockAllLineupsResult = {
    errors: [],
    locked: [],
    skipped: []
  };

  for (const league of leagues) {
    const nextMatchday = getNextUsefulMatchday(league.matchdays);
    if (!nextMatchday) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: "nessuna giornata utile"
      });
      continue;
    }

    if (nextMatchday.status !== MatchdayStatus.LINEUPS_OPEN) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${nextMatchday.number}: formazioni non aperte (${nextMatchday.status})`
      });
      continue;
    }

    try {
      const locked = await lockMatchdayLineups(nextMatchday.id);
      result.locked.push({
        leagueId: league.id,
        leagueName: league.name,
        result: locked
      });
    } catch (error) {
      result.errors.push({
        leagueId: league.id,
        leagueName: league.name,
        error:
          error instanceof Error ? error.message : "Chiusura non riuscita."
      });
    }
  }

  return result;
}

export function formatLockAllLineupsNotice(
  summary: LockAllLineupsResult
): string {
  const ok = summary.locked.length;
  const skipped = summary.skipped.length;
  const errors = summary.errors.length;

  if (ok === 0 && skipped === 0 && errors === 0) {
    return "Nessuna lega trovata.";
  }

  const parts = [
    `Formazioni chiuse: ${ok} leghe ok`,
    `${skipped} saltate`,
    `${errors} errori`
  ];

  if (errors > 0) {
    const preview = summary.errors
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.error}`)
      .join(" | ");
    return `${parts.join(", ")}. ${preview}${errors > 3 ? "…" : ""}`;
  }

  return `${parts.join(", ")}.`;
}
