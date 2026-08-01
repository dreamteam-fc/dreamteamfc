import {
  TournamentFixtureStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";

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

/**
 * Somma gol di una squadra su una serie A/R (o singola finale).
 * In andata/ritorno i campi si invertono al ritorno.
 */
export function aggregateSeriesGoals(
  fixtures: Array<{
    awayGoals: number | null;
    awayTeamId: string | null;
    homeGoals: number | null;
    homeTeamId: string | null;
  }>,
  teamId: string
): number {
  let total = 0;

  for (const fixture of fixtures) {
    if (
      fixture.homeGoals == null ||
      fixture.awayGoals == null ||
      !fixture.homeTeamId ||
      !fixture.awayTeamId
    ) {
      continue;
    }

    if (fixture.homeTeamId === teamId) {
      total += fixture.homeGoals;
    } else if (fixture.awayTeamId === teamId) {
      total += fixture.awayGoals;
    }
  }

  return total;
}

export function resolveSeriesWinner(options: {
  fixtures: Array<{
    awayGoals: number | null;
    awayTeamId: string | null;
    homeGoals: number | null;
    homeTeamId: string | null;
    leg: number;
  }>;
  seedRankByTeamId: Map<string, number>;
}): string {
  const { fixtures, seedRankByTeamId } = options;
  const first = fixtures[0];

  if (!first?.homeTeamId || !first.awayTeamId) {
    throw new Error("Serie incompleta: mancano le squadre.");
  }

  const teamA = first.homeTeamId;
  const teamB = first.awayTeamId;

  for (const fixture of fixtures) {
    if (fixture.homeGoals == null || fixture.awayGoals == null) {
      throw new Error("Serie incompleta: mancano ancora dei risultati.");
    }
  }

  const goalsA = aggregateSeriesGoals(fixtures, teamA);
  const goalsB = aggregateSeriesGoals(fixtures, teamB);

  if (goalsA > goalsB) {
    return teamA;
  }

  if (goalsB > goalsA) {
    return teamB;
  }

  // Pareggio aggregato: vince il seed migliore (rank più basso).
  const rankA = seedRankByTeamId.get(teamA) ?? Number.MAX_SAFE_INTEGER;
  const rankB = seedRankByTeamId.get(teamB) ?? Number.MAX_SAFE_INTEGER;

  if (rankA !== rankB) {
    return rankA < rankB ? teamA : teamB;
  }

  return teamA.localeCompare(teamB) <= 0 ? teamA : teamB;
}

async function advanceWinnerIfSeriesComplete(options: {
  roundId: string;
  seriesKey: string;
  tournamentId: string;
}) {
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
          awayGoals: true,
          awayTeamId: true,
          bracketSlot: true,
          homeGoals: true,
          homeTeamId: true,
          id: true,
          leg: true,
          status: true
        }
      }
    }
  });

  if (!round) {
    return;
  }

  const expectedLegs = round.isFinal ? 1 : 2;
  if (round.fixtures.length !== expectedLegs) {
    return;
  }

  if (
    round.fixtures.some(
      (fixture) =>
        fixture.status !== TournamentFixtureStatus.COMPLETED ||
        fixture.homeGoals == null ||
        fixture.awayGoals == null
    )
  ) {
    return;
  }

  if (round.isFinal) {
    await prisma.tournament.update({
      where: { id: options.tournamentId },
      data: { status: TournamentStatus.COMPLETED }
    });
    return;
  }

  const entries = await prisma.tournamentTeamEntry.findMany({
    where: { tournamentId: options.tournamentId },
    select: {
      fantasyTeamId: true,
      seedRank: true
    }
  });
  const seedRankByTeamId = new Map(
    entries.map((entry) => [
      entry.fantasyTeamId,
      entry.seedRank ?? Number.MAX_SAFE_INTEGER
    ])
  );

  const winnerId = resolveSeriesWinner({
    fixtures: round.fixtures,
    seedRankByTeamId
  });

  const bracketSlot = round.fixtures[0].bracketSlot;
  const nextRoundIndex = round.roundIndex + 1;
  const nextSlot = Math.floor(bracketSlot / 2);
  const isHomeSide = bracketSlot % 2 === 0;

  const nextRound = await prisma.tournamentRound.findUnique({
    where: {
      tournamentId_roundIndex: {
        roundIndex: nextRoundIndex,
        tournamentId: options.tournamentId
      }
    },
    select: {
      id: true,
      isFinal: true,
      fixtures: {
        where: {
          bracketSlot: nextSlot
        },
        orderBy: { leg: "asc" },
        select: {
          awayTeamId: true,
          homeTeamId: true,
          id: true,
          leg: true,
          seriesKey: true,
          status: true
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
          ? { homeTeamId: winnerId }
          : { awayTeamId: winnerId }
        : isHomeSide
          ? { awayTeamId: winnerId }
          : { homeTeamId: winnerId };

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

export async function recordTournamentFixtureResult(options: {
  awayGoals: unknown;
  fixtureId: string;
  homeGoals: unknown;
}) {
  const homeGoals = parseNonNegativeInt(options.homeGoals, "Gol casa");
  const awayGoals = parseNonNegativeInt(options.awayGoals, "Gol trasferta");

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
      awayGoals,
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

  await advanceWinnerIfSeriesComplete({
    roundId: fixture.round.id,
    seriesKey: fixture.seriesKey,
    tournamentId: fixture.round.tournamentId
  });

  return {
    fixtureId: fixture.id,
    tournamentId: fixture.round.tournamentId
  };
}
