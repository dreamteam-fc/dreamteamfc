import { prisma } from "../../prisma.ts";
import { calculateLeagueStandings } from "../standings/calculate-league-standings.ts";
import { prismaDecimalToNumber } from "../votes/shared.ts";

/**
 * Best-effort: fill seedFantapunti=0 entries from current league standings.
 */
export async function backfillTournamentEntrySeedFantapunti(options?: {
  tournamentId?: string;
}): Promise<{ updated: number; skipped: number }> {
  const entries = await prisma.tournamentTeamEntry.findMany({
    where: {
      ...(options?.tournamentId
        ? { tournamentId: options.tournamentId }
        : {}),
      seedFantapunti: 0
    },
    select: {
      id: true,
      fantasyTeamId: true,
      sourceLeagueId: true,
      seedFantapunti: true
    }
  });

  if (entries.length === 0) {
    return { skipped: 0, updated: 0 };
  }

  const leagueIds = Array.from(
    new Set(entries.map((entry) => entry.sourceLeagueId))
  );
  const fantapuntiByTeam = new Map<string, number>();

  for (const leagueId of leagueIds) {
    const standings = await calculateLeagueStandings(leagueId);
    for (const row of standings.standings) {
      fantapuntiByTeam.set(row.teamId, row.fantasyPointsTotal);
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const current = prismaDecimalToNumber(entry.seedFantapunti) ?? 0;
    if (current !== 0) {
      skipped += 1;
      continue;
    }

    const value = fantapuntiByTeam.get(entry.fantasyTeamId);
    if (value == null || value === 0) {
      skipped += 1;
      continue;
    }

    await prisma.tournamentTeamEntry.update({
      where: { id: entry.id },
      data: { seedFantapunti: value }
    });
    updated += 1;
  }

  return { skipped, updated };
}
