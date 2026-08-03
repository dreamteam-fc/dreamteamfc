import { MatchdayStatus } from "@prisma/client";

import { getNextUsefulMatchday } from "../../matchdays/next-useful-matchday.ts";
import { prisma } from "../../prisma.ts";
import {
  publishMatchday,
  type PublishMatchdayResult
} from "./publish-matchday.ts";

export type PublishAllMatchdaysOptions = {
  /**
   * When set (pagelle unificate), process that matchday number per league.
   * Otherwise target each league's next useful matchday (dashboard batch).
   */
  matchdayNumber?: number;
};

export type PublishAllMatchdaysResult = {
  errors: Array<{ leagueId: string; leagueName: string; error: string }>;
  published: Array<{
    leagueId: string;
    leagueName: string;
    matchdayId: string;
    matchdayNumber: number;
    result: PublishMatchdayResult;
  }>;
  skipped: Array<{ leagueId: string; leagueName: string; reason: string }>;
};

type LeagueMatchdayTarget = {
  id: string;
  number: number;
  status: MatchdayStatus;
};

/**
 * Batch publish for platform admin.
 *
 * Per league: publish the next useful matchday when status is SCORES_CALCULATED
 * (or the explicit matchday number from pagelle unificate). Reuses publishMatchday.
 * Not-ready / already-published matchdays are skipped, not errors.
 */
export async function publishAllMatchdays(
  options: PublishAllMatchdaysOptions = {}
): Promise<PublishAllMatchdaysResult> {
  const matchdayNumber = options.matchdayNumber;
  const hasExplicitNumber =
    typeof matchdayNumber === "number" &&
    Number.isInteger(matchdayNumber) &&
    matchdayNumber > 0;

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

  const result: PublishAllMatchdaysResult = {
    errors: [],
    published: [],
    skipped: []
  };

  for (const league of leagues) {
    const target = resolveTargetMatchday(league.matchdays, {
      hasExplicitNumber,
      matchdayNumber
    });

    if (!target) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: hasExplicitNumber
          ? `giornata ${matchdayNumber} assente`
          : "nessuna giornata utile"
      });
      continue;
    }

    if (target.status === MatchdayStatus.PUBLISHED) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${target.number}: già pubblicata`
      });
      continue;
    }

    if (target.status === MatchdayStatus.LOCKED) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${target.number}: già chiusa (${target.status})`
      });
      continue;
    }

    if (target.status !== MatchdayStatus.SCORES_CALCULATED) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: `giornata ${target.number}: non pronta (${target.status})`
      });
      continue;
    }

    try {
      const published = await publishMatchday(target.id);
      result.published.push({
        leagueId: league.id,
        leagueName: league.name,
        matchdayId: target.id,
        matchdayNumber: target.number,
        result: published
      });
    } catch (error) {
      result.errors.push({
        leagueId: league.id,
        leagueName: league.name,
        error:
          error instanceof Error
            ? error.message
            : "Pubblicazione giornata non riuscita."
      });
    }
  }

  return result;
}

function resolveTargetMatchday(
  matchdays: LeagueMatchdayTarget[],
  options: { hasExplicitNumber: boolean; matchdayNumber?: number }
): LeagueMatchdayTarget | null {
  if (options.hasExplicitNumber && typeof options.matchdayNumber === "number") {
    return (
      matchdays.find((matchday) => matchday.number === options.matchdayNumber) ??
      null
    );
  }

  return getNextUsefulMatchday(matchdays);
}

export function formatPublishAllMatchdaysNotice(
  summary: PublishAllMatchdaysResult
): string {
  const ok = summary.published.length;
  const skipped = summary.skipped.length;
  const errors = summary.errors.length;

  if (ok === 0 && skipped === 0 && errors === 0) {
    return "Nessuna lega trovata.";
  }

  const parts = [
    `Giornate pubblicate: ${ok} leghe ok`,
    `${skipped} saltate`,
    `${errors} errori`
  ];

  const details: string[] = [];

  if (skipped > 0) {
    const preview = summary.skipped
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.reason}`)
      .join(" | ");
    details.push(`${preview}${skipped > 3 ? "…" : ""}`);
  }

  if (errors > 0) {
    const preview = summary.errors
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.error}`)
      .join(" | ");
    details.push(`${preview}${errors > 3 ? "…" : ""}`);
  }

  if (details.length === 0) {
    return `${parts.join(", ")}.`;
  }

  return `${parts.join(", ")}. ${details.join(" · ")}`;
}
