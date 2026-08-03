import { MatchdayStatus } from "@prisma/client";

import { getNextUsefulMatchday } from "../../matchdays/next-useful-matchday.ts";
import { prisma } from "../../prisma.ts";
import {
  openMatchdayLineups,
  type OpenMatchdayLineupsResult
} from "./open-matchday-lineups.ts";

export type OpenAllLineupsResult = {
  errors: Array<{ leagueId: string; leagueName: string; error: string }>;
  opened: Array<{
    leagueId: string;
    leagueName: string;
    result: OpenMatchdayLineupsResult;
  }>;
  skipped: Array<{ leagueId: string; leagueName: string; reason: string }>;
};

/**
 * Batch lineup open for platform admin.
 *
 * For each league, targets the next useful matchday (same spirit as the admin
 * dashboard / lock-all batch). Opens only when status is DRAFT.
 */
export async function openAllLineups(): Promise<OpenAllLineupsResult> {
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

  const result: OpenAllLineupsResult = {
    errors: [],
    opened: [],
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

    if (nextMatchday.status !== MatchdayStatus.DRAFT) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${nextMatchday.number}: formazioni non apribili (${nextMatchday.status})`
      });
      continue;
    }

    try {
      const opened = await openMatchdayLineups(nextMatchday.id);
      result.opened.push({
        leagueId: league.id,
        leagueName: league.name,
        result: opened
      });
    } catch (error) {
      result.errors.push({
        leagueId: league.id,
        leagueName: league.name,
        error:
          error instanceof Error ? error.message : "Apertura non riuscita."
      });
    }
  }

  return result;
}

export function formatOpenAllLineupsNotice(
  summary: OpenAllLineupsResult
): string {
  const ok = summary.opened.length;
  const skipped = summary.skipped.length;
  const errors = summary.errors.length;

  if (ok === 0 && skipped === 0 && errors === 0) {
    return "Nessuna lega trovata.";
  }

  const parts = [
    `Formazioni aperte: ${ok} leghe ok`,
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
