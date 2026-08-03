import { prisma } from "../../prisma.ts";
import { FULL_LEAGUE_TEAM_COUNT } from "../rosters/roster-presence.ts";
import {
  generateLeagueSchedule,
  type GenerateLeagueScheduleResult
} from "./generate-league-schedule.ts";

const ALREADY_GENERATED_MESSAGE =
  "Calendario già generato o giornate già presenti.";

export type GenerateAllLeagueSchedulesInput = {
  /**
   * When true, attempt generation even if matchdays already exist.
   * Complete calendars still fail inside generateLeagueSchedule.
   * Default: skip leagues that already have a calendar.
   */
  force?: boolean;
};

export type GenerateAllLeagueSchedulesResult = {
  errors: Array<{ leagueId: string; leagueName: string; error: string }>;
  generated: Array<{
    leagueId: string;
    leagueName: string;
    result: GenerateLeagueScheduleResult;
  }>;
  skipped: Array<{ leagueId: string; leagueName: string; reason: string }>;
};

/**
 * Batch calendar generation for platform admin.
 *
 * Eligible: exactly 10 teams (same hard requirement as generateLeagueSchedule /
 * lineups-hub team size). Leagues that already have matchdays are skipped by
 * default so a second click is idempotent.
 */
export async function generateAllLeagueSchedules(
  input: GenerateAllLeagueSchedulesInput = {}
): Promise<GenerateAllLeagueSchedulesResult> {
  const force = input.force === true;

  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          fantasyTeams: true,
          matchdays: true
        }
      }
    }
  });

  const result: GenerateAllLeagueSchedulesResult = {
    errors: [],
    generated: [],
    skipped: []
  };

  const eligible = leagues.filter(
    (league) => league._count.fantasyTeams === FULL_LEAGUE_TEAM_COUNT
  );

  for (const league of eligible) {
    if (league._count.matchdays > 0 && !force) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: "già presente"
      });
      continue;
    }

    try {
      const schedule = await generateLeagueSchedule({
        leagueId: league.id,
        mode: "DOUBLE_ROUND"
      });
      result.generated.push({
        leagueId: league.id,
        leagueName: league.name,
        result: schedule
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generazione non riuscita.";

      if (message === ALREADY_GENERATED_MESSAGE) {
        result.skipped.push({
          leagueId: league.id,
          leagueName: league.name,
          reason: "già presente"
        });
        continue;
      }

      result.errors.push({
        leagueId: league.id,
        leagueName: league.name,
        error: message
      });
    }
  }

  return result;
}

export function formatGenerateAllLeagueSchedulesNotice(
  summary: GenerateAllLeagueSchedulesResult
): string {
  const ok = summary.generated.length;
  const skipped = summary.skipped.length;
  const errors = summary.errors.length;

  const parts = [
    `Calendari: ${ok} ok`,
    `${skipped} saltati (già presenti)`,
    `${errors} errori`
  ];

  if (ok === 0 && skipped === 0 && errors === 0) {
    return "Nessuna lega idonea per generare il calendario (servono esattamente 10 squadre).";
  }

  if (errors > 0) {
    const preview = summary.errors
      .slice(0, 3)
      .map((item) => `${item.leagueName}: ${item.error}`)
      .join(" | ");
    return `${parts.join(", ")}. ${preview}${errors > 3 ? "…" : ""}`;
  }

  return `${parts.join(", ")}.`;
}
