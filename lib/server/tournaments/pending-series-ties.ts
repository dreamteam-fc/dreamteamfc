import { TournamentFixtureStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { prismaDecimalToNumber } from "@/lib/server/votes/shared.ts";
import {
  resolveSeriesWinner,
  type SeriesTeamTotals
} from "@/lib/tournaments/resolve-series-winner.ts";

export type PendingSeriesTie = {
  bracketSlot: number;
  roundId: string;
  roundName: string;
  seriesKey: string;
  teamA: SeriesTeamTotals & { name: string };
  teamB: SeriesTeamTotals & { name: string };
};

/**
 * Fully completed series (both legs, or final) without an explicit winner.
 */
export async function listPendingTournamentSeriesTies(
  tournamentId: string
): Promise<PendingSeriesTie[]> {
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    orderBy: { roundIndex: "asc" },
    select: {
      id: true,
      isFinal: true,
      name: true,
      fixtures: {
        orderBy: [{ bracketSlot: "asc" }, { leg: "asc" }],
        select: {
          awayFantapunti: true,
          awayGoals: true,
          awayTeamId: true,
          bracketSlot: true,
          homeFantapunti: true,
          homeGoals: true,
          homeTeamId: true,
          leg: true,
          seriesKey: true,
          seriesWinnerTeamId: true,
          status: true,
          awayTeam: { select: { id: true, name: true } },
          homeTeam: { select: { id: true, name: true } }
        }
      }
    }
  });

  const entries = await prisma.tournamentTeamEntry.findMany({
    where: { tournamentId },
    select: {
      fantasyTeamId: true,
      seedFantapunti: true,
      seedPoints: true
    }
  });
  const seedByTeamId = new Map(
    entries.map((entry) => [
      entry.fantasyTeamId,
      {
        seedFantapunti: prismaDecimalToNumber(entry.seedFantapunti) ?? 0,
        seedPoints: entry.seedPoints
      }
    ])
  );

  const pending: PendingSeriesTie[] = [];

  for (const round of rounds) {
    const bySeries = new Map<string, (typeof round.fixtures)[number][]>();
    for (const fixture of round.fixtures) {
      const list = bySeries.get(fixture.seriesKey) ?? [];
      list.push(fixture);
      bySeries.set(fixture.seriesKey, list);
    }

    const expectedLegs = round.isFinal ? 1 : 2;

    for (const [seriesKey, fixtures] of bySeries) {
      if (fixtures.length !== expectedLegs) {
        continue;
      }

      if (
        fixtures.some(
          (fixture) =>
            fixture.status !== TournamentFixtureStatus.COMPLETED ||
            fixture.homeGoals == null ||
            fixture.awayGoals == null ||
            !fixture.homeTeamId ||
            !fixture.awayTeamId
        )
      ) {
        continue;
      }

      if (fixtures.some((fixture) => fixture.seriesWinnerTeamId != null)) {
        continue;
      }

      const resolved = resolveSeriesWinner({
        fixtures: fixtures.map((fixture) => ({
          awayFantapunti: prismaDecimalToNumber(fixture.awayFantapunti),
          awayGoals: fixture.awayGoals,
          awayTeamId: fixture.awayTeamId,
          homeFantapunti: prismaDecimalToNumber(fixture.homeFantapunti),
          homeGoals: fixture.homeGoals,
          homeTeamId: fixture.homeTeamId,
          leg: fixture.leg
        })),
        seedByTeamId
      });

      // Pending for admin UI / gate: missing winner after auto rules.
      // If rules would auto-pick, still list until heal/auto-resolve runs.
      const nameById = new Map<string, string>();
      for (const fixture of fixtures) {
        if (fixture.homeTeam) {
          nameById.set(fixture.homeTeam.id, fixture.homeTeam.name);
        }
        if (fixture.awayTeam) {
          nameById.set(fixture.awayTeam.id, fixture.awayTeam.name);
        }
      }

      const [totalsA, totalsB] = resolved.totals;

      pending.push({
        bracketSlot: fixtures[0].bracketSlot,
        roundId: round.id,
        roundName: round.name,
        seriesKey,
        teamA: {
          ...totalsA,
          name: nameById.get(totalsA.teamId) ?? totalsA.teamId
        },
        teamB: {
          ...totalsB,
          name: nameById.get(totalsB.teamId) ?? totalsB.teamId
        }
      });
    }
  }

  return pending;
}

export async function assertNoPendingTournamentSeriesTies(
  tournamentId: string
): Promise<void> {
  const pending = await listPendingTournamentSeriesTies(tournamentId);
  if (pending.length === 0) {
    return;
  }

  const labels = pending
    .map(
      (series) =>
        `${series.roundName} serie #${series.bracketSlot + 1} (${series.teamA.name} vs ${series.teamB.name})`
    )
    .join("; ");

  throw new Error(
    `Non puoi avviare una nuova giornata: scegli prima un vincitore per ogni serie in parità (${pending.length}). ${labels}`
  );
}
