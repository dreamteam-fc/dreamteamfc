import { getNextUsefulMatchday } from "../../matchdays/next-useful-matchday.ts";
import { prisma } from "../../prisma.ts";
import { isRosterInserted } from "../rosters/roster-presence.ts";
import {
  generateRandomLineupsForMatchday,
  type GenerateRandomLineupsResult
} from "./generate-random-lineups-for-matchday.ts";

export type GenerateAllRandomLineupsResult = {
  errors: Array<{ leagueId: string; leagueName: string; error: string }>;
  generated: Array<{
    leagueId: string;
    leagueName: string;
    result: GenerateRandomLineupsResult;
  }>;
  skipped: Array<{ leagueId: string; leagueName: string; reason: string }>;
};

/**
 * Batch random lineup generation for platform admin.
 *
 * For each league, targets the next useful matchday (same spirit as the admin
 * dashboard / lineups hub). Writes forced random SUBMITTED lineups for every
 * team that already has a complete roster.
 */
export async function generateAllRandomLineups(): Promise<GenerateAllRandomLineupsResult> {
  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      fantasyTeams: {
        select: {
          id: true,
          _count: {
            select: {
              roster: true
            }
          }
        }
      },
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

  const result: GenerateAllRandomLineupsResult = {
    errors: [],
    generated: [],
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

    const teamIdsWithRoster = league.fantasyTeams
      .filter((team) => isRosterInserted(team._count.roster))
      .map((team) => team.id);

    if (teamIdsWithRoster.length === 0) {
      result.skipped.push({
        leagueId: league.id,
        leagueName: league.name,
        reason: "nessuna rosa completa"
      });
      continue;
    }

    try {
      const lineupResult = await generateRandomLineupsForMatchday({
        force: true,
        fantasyTeamIds: teamIdsWithRoster,
        leagueId: league.id,
        matchdayId: nextMatchday.id
      });

      if (lineupResult.written === 0 && lineupResult.failures.length > 0) {
        const preview = lineupResult.failures
          .slice(0, 2)
          .map((failure) => `${failure.teamName}: ${failure.error}`)
          .join(" | ");
        result.errors.push({
          leagueId: league.id,
          leagueName: league.name,
          error: `Giornata ${lineupResult.matchdayNumber}: nessuna formazione scritta. ${preview}`
        });
        continue;
      }

      result.generated.push({
        leagueId: league.id,
        leagueName: league.name,
        result: lineupResult
      });
    } catch (error) {
      result.errors.push({
        leagueId: league.id,
        leagueName: league.name,
        error:
          error instanceof Error ? error.message : "Generazione non riuscita."
      });
    }
  }

  return result;
}

export function formatGenerateAllRandomLineupsNotice(
  summary: GenerateAllRandomLineupsResult
): string {
  const ok = summary.generated.length;
  const skipped = summary.skipped.length;
  const errors = summary.errors.length;
  const written = summary.generated.reduce(
    (total, item) => total + item.result.written,
    0
  );
  const teamFailures = summary.generated.reduce(
    (total, item) => total + item.result.failures.length,
    0
  );

  if (ok === 0 && skipped === 0 && errors === 0) {
    return "Nessuna lega trovata.";
  }

  const parts = [
    `Formazioni: ${ok} leghe ok (${written} scritte)`,
    `${skipped} saltate`,
    `${errors} errori`
  ];

  if (teamFailures > 0) {
    parts.push(`${teamFailures} squadre fallite`);
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
