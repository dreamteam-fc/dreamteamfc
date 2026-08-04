import {
  Prisma,
  TournamentFixtureStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import { prismaDecimalToNumber } from "@/lib/server/votes/shared.ts";
import {
  resolveSeriesWinner,
  type SeriesFixtureScore,
  type SeriesTeamSeed
} from "@/lib/tournaments/resolve-series-winner.ts";

function parseNonNegativeInt(value: unknown, label: string): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${label} non valido.`);
  }

  const parsed =
    typeof value === "number" ? value : Number.parseInt(value.trim(), 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} deve essere un intero >= 0.`);
  }

  return parsed;
}

function parseNonNegativeNumber(value: unknown, label: string): number {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${label} non valido.`);
  }

  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value.trim());

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} deve essere un numero >= 0.`);
  }

  return parsed;
}

function toFixtureScores(
  fixtures: Array<{
    awayFantapunti: Prisma.Decimal | number | null;
    awayGoals: number | null;
    awayTeamId: string | null;
    homeFantapunti: Prisma.Decimal | number | null;
    homeGoals: number | null;
    homeTeamId: string | null;
    leg: number;
  }>
): SeriesFixtureScore[] {
  return fixtures.map((fixture) => ({
    awayFantapunti: prismaDecimalToNumber(fixture.awayFantapunti),
    awayGoals: fixture.awayGoals,
    awayTeamId: fixture.awayTeamId,
    homeFantapunti: prismaDecimalToNumber(fixture.homeFantapunti),
    homeGoals: fixture.homeGoals,
    homeTeamId: fixture.homeTeamId,
    leg: fixture.leg
  }));
}

async function loadSeedByTeamId(
  tournamentId: string
): Promise<Map<string, SeriesTeamSeed>> {
  const entries = await prisma.tournamentTeamEntry.findMany({
    where: { tournamentId },
    select: {
      fantasyTeamId: true,
      seedFantapunti: true,
      seedPoints: true
    }
  });

  return new Map(
    entries.map((entry) => [
      entry.fantasyTeamId,
      {
        seedFantapunti: prismaDecimalToNumber(entry.seedFantapunti) ?? 0,
        seedPoints: entry.seedPoints
      }
    ])
  );
}

async function placeWinnerInNextRound(options: {
  bracketSlot: number;
  roundIndex: number;
  tournamentId: string;
  winnerId: string;
}) {
  const nextRoundIndex = options.roundIndex + 1;
  const nextSlot = Math.floor(options.bracketSlot / 2);
  const isHomeSide = options.bracketSlot % 2 === 0;

  const nextRound = await prisma.tournamentRound.findUnique({
    where: {
      tournamentId_roundIndex: {
        roundIndex: nextRoundIndex,
        tournamentId: options.tournamentId
      }
    },
    select: {
      id: true,
      fixtures: {
        where: {
          bracketSlot: nextSlot
        },
        orderBy: { leg: "asc" },
        select: {
          awayTeamId: true,
          homeTeamId: true,
          id: true,
          leg: true
        }
      }
    }
  });

  if (!nextRound) {
    throw new Error("Fase successiva non trovata nel tabellone.");
  }

  for (const fixture of nextRound.fixtures) {
    const data =
      fixture.leg === 1
        ? isHomeSide
          ? { homeTeamId: options.winnerId }
          : { awayTeamId: options.winnerId }
        : isHomeSide
          ? { awayTeamId: options.winnerId }
          : { homeTeamId: options.winnerId };

    await prisma.tournamentFixture.update({
      where: { id: fixture.id },
      data
    });
  }

  const refreshed = await prisma.tournamentFixture.findMany({
    where: {
      roundId: nextRound.id,
      bracketSlot: nextSlot
    },
    select: {
      awayTeamId: true,
      homeTeamId: true,
      id: true
    }
  });

  const bothReady = refreshed.every(
    (fixture) => fixture.homeTeamId && fixture.awayTeamId
  );

  if (bothReady) {
    await prisma.tournamentFixture.updateMany({
      where: {
        id: { in: refreshed.map((fixture) => fixture.id) }
      },
      data: {
        status: TournamentFixtureStatus.READY
      }
    });
  }
}

export async function applySeriesWinner(options: {
  roundId: string;
  seriesKey: string;
  tournamentId: string;
  winnerId: string;
}) {
  const round = await prisma.tournamentRound.findUnique({
    where: { id: options.roundId },
    select: {
      id: true,
      isFinal: true,
      roundIndex: true,
      fixtures: {
        where: { seriesKey: options.seriesKey },
        orderBy: { leg: "asc" },
        select: {
          awayTeamId: true,
          bracketSlot: true,
          homeTeamId: true,
          id: true,
          seriesWinnerTeamId: true
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  const teamIds = new Set<string>();
  for (const fixture of round.fixtures) {
    if (fixture.homeTeamId) {
      teamIds.add(fixture.homeTeamId);
    }
    if (fixture.awayTeamId) {
      teamIds.add(fixture.awayTeamId);
    }
  }

  if (!teamIds.has(options.winnerId)) {
    throw new Error("Il vincitore deve essere una delle due squadre della serie.");
  }

  if (
    round.fixtures.some(
      (fixture) =>
        fixture.seriesWinnerTeamId != null &&
        fixture.seriesWinnerTeamId !== options.winnerId
    )
  ) {
    throw new Error("Questa serie ha gia un vincitore diverso.");
  }

  await prisma.tournamentFixture.updateMany({
    where: {
      roundId: options.roundId,
      seriesKey: options.seriesKey
    },
    data: {
      seriesWinnerTeamId: options.winnerId
    }
  });

  if (round.isFinal) {
    await prisma.tournament.update({
      where: { id: options.tournamentId },
      data: { status: TournamentStatus.COMPLETED }
    });
    return { advanced: false as const, winnerId: options.winnerId };
  }

  await placeWinnerInNextRound({
    bracketSlot: round.fixtures[0].bracketSlot,
    roundIndex: round.roundIndex,
    tournamentId: options.tournamentId,
    winnerId: options.winnerId
  });

  return { advanced: true as const, winnerId: options.winnerId };
}

async function advanceWinnerIfSeriesComplete(options: {
  roundId: string;
  seriesKey: string;
  tournamentId: string;
}): Promise<"advanced" | "tied" | "incomplete" | "final_done"> {
  const round = await prisma.tournamentRound.findUnique({
    where: { id: options.roundId },
    select: {
      id: true,
      isFinal: true,
      roundIndex: true,
      tournamentId: true,
      fixtures: {
        where: { seriesKey: options.seriesKey },
        orderBy: { leg: "asc" },
        select: {
          awayFantapunti: true,
          awayGoals: true,
          awayTeamId: true,
          bracketSlot: true,
          homeFantapunti: true,
          homeGoals: true,
          homeTeamId: true,
          id: true,
          leg: true,
          seriesWinnerTeamId: true,
          status: true
        }
      }
    }
  });

  if (!round) {
    return "incomplete";
  }

  const expectedLegs = round.isFinal ? 1 : 2;
  if (round.fixtures.length !== expectedLegs) {
    return "incomplete";
  }

  if (
    round.fixtures.some(
      (fixture) =>
        fixture.status !== TournamentFixtureStatus.COMPLETED ||
        fixture.homeGoals == null ||
        fixture.awayGoals == null
    )
  ) {
    return "incomplete";
  }

  const existingWinner = round.fixtures.find(
    (fixture) => fixture.seriesWinnerTeamId != null
  )?.seriesWinnerTeamId;

  if (existingWinner) {
    if (round.isFinal) {
      return "final_done";
    }
    return "advanced";
  }

  const seedByTeamId = await loadSeedByTeamId(options.tournamentId);
  const resolved = resolveSeriesWinner({
    fixtures: toFixtureScores(round.fixtures),
    seedByTeamId
  });

  if (resolved.kind === "tied") {
    return "tied";
  }

  await applySeriesWinner({
    roundId: options.roundId,
    seriesKey: options.seriesKey,
    tournamentId: options.tournamentId,
    winnerId: resolved.winnerId
  });

  return round.isFinal ? "final_done" : "advanced";
}

export async function recordTournamentFixtureResult(options: {
  awayFantapunti?: unknown;
  awayGoals: unknown;
  fixtureId: string;
  homeFantapunti?: unknown;
  homeGoals: unknown;
}) {
  const homeGoals = parseNonNegativeInt(options.homeGoals, "Gol casa");
  const awayGoals = parseNonNegativeInt(options.awayGoals, "Gol trasferta");
  const homeFantapunti = parseNonNegativeNumber(
    options.homeFantapunti,
    "Fantapunti casa"
  );
  const awayFantapunti = parseNonNegativeNumber(
    options.awayFantapunti,
    "Fantapunti trasferta"
  );

  const fixture = await prisma.tournamentFixture.findUnique({
    where: { id: options.fixtureId },
    select: {
      id: true,
      awayTeamId: true,
      homeTeamId: true,
      seriesKey: true,
      status: true,
      round: {
        select: {
          id: true,
          tournamentId: true,
          tournament: {
            select: {
              id: true,
              status: true
            }
          }
        }
      }
    }
  });

  if (!fixture) {
    throw new Error("Partita non trovata.");
  }

  if (
    fixture.round.tournament.status !== TournamentStatus.BRACKET_GENERATED &&
    fixture.round.tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new Error("Risultati non modificabili in questo stato del torneo.");
  }

  if (fixture.status === TournamentFixtureStatus.COMPLETED) {
    throw new Error("Risultato gia registrato per questa partita.");
  }

  if (fixture.status !== TournamentFixtureStatus.READY) {
    throw new Error("La partita non e ancora pronta (squadre da definire).");
  }

  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Partita incompleta: mancano le squadre.");
  }

  await prisma.tournamentFixture.update({
    where: { id: fixture.id },
    data: {
      awayFantapunti,
      awayGoals,
      homeFantapunti,
      homeGoals,
      status: TournamentFixtureStatus.COMPLETED
    }
  });

  if (fixture.round.tournament.status === TournamentStatus.BRACKET_GENERATED) {
    await prisma.tournament.update({
      where: { id: fixture.round.tournamentId },
      data: { status: TournamentStatus.IN_PROGRESS }
    });
  }

  const seriesOutcome = await advanceWinnerIfSeriesComplete({
    roundId: fixture.round.id,
    seriesKey: fixture.seriesKey,
    tournamentId: fixture.round.tournamentId
  });

  return {
    fixtureId: fixture.id,
    seriesOutcome,
    tournamentId: fixture.round.tournamentId
  };
}

/** Re-export pure helpers for callers/tests. */
export {
  aggregateSeriesFantapunti,
  aggregateSeriesGoals,
  resolveSeriesWinner
} from "@/lib/tournaments/resolve-series-winner.ts";
