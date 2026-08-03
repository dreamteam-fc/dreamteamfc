import { randomUUID } from "node:crypto";

import {
  FantasyFixtureStatus,
  MatchdayStatus,
  type PrismaClient
} from "@prisma/client";

import { prisma } from "../../prisma.ts";
import {
  generateRoundRobinSchedule,
  type RoundRobinMode
} from "./generate-round-robin-schedule.ts";

export type GenerateLeagueScheduleInput = {
  leagueId: string;
  mode: RoundRobinMode;
};

export type GenerateLeagueScheduleResult = {
  byeCount: number;
  fixtureCount: number;
  matchdayCount: number;
  mode: RoundRobinMode;
};

type ScheduleInspection = {
  fixtureCount: number;
  hasProgressedWork: boolean;
  matchdayCount: number;
};

/**
 * Calendar generation must NOT use a long interactive `$transaction`.
 *
 * On Supabase PgBouncer (Transaction :6543 and often Session :5432 under load),
 * Prisma interactive transactions drop mid-flight with:
 *   "Transaction not found. Transaction ID is invalid..."
 *
 * Durable approach: precompute in memory, wipe incomplete DRAFT leftovers,
 * then write with plain createMany (no interactive tx spanning 18 matchdays).
 */
export async function generateLeagueSchedule(
  input: GenerateLeagueScheduleInput
): Promise<GenerateLeagueScheduleResult> {
  return writeLeagueSchedule(prisma, input);
}

async function writeLeagueSchedule(
  db: PrismaClient,
  input: GenerateLeagueScheduleInput
): Promise<GenerateLeagueScheduleResult> {
  const league = await db.league.findUnique({
    where: {
      id: input.leagueId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!league) {
    throw new Error("Lega non trovata.");
  }

  const teams = await db.fantasyTeam.findMany({
    where: {
      leagueId: league.id
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true
    }
  });

  if (teams.length < 2) {
    throw new Error("Servono almeno 2 squadre per generare il calendario.");
  }

  if (input.mode !== "DOUBLE_ROUND") {
    throw new Error(
      "Il campionato supporta solo andata e ritorno (18 giornate con 10 squadre)."
    );
  }

  if (teams.length !== 10) {
    throw new Error(
      `Per il campionato servono esattamente 10 squadre (ora: ${teams.length}).`
    );
  }

  const rounds = generateRoundRobinSchedule({
    mode: input.mode,
    teamIds: teams.map((team) => team.id)
  });

  const expectedMatchdayCount = rounds.length;
  const expectedFixtureCount = rounds.reduce(
    (count, round) => count + round.fixtures.length,
    0
  );
  const byeCount = rounds.reduce(
    (count, round) => count + (round.byeTeamId ? 1 : 0),
    0
  );

  await ensureScheduleWritable(db, {
    expectedFixtureCount,
    expectedMatchdayCount,
    leagueId: league.id
  });

  const matchdayIdsByNumber = new Map<number, string>();
  const matchdayRows = rounds.map((round) => {
    const id = randomUUID();
    matchdayIdsByNumber.set(round.roundNumber, id);
    return {
      id,
      leagueId: league.id,
      number: round.roundNumber,
      status: MatchdayStatus.DRAFT
    };
  });

  const fixtureRows = rounds.flatMap((round) => {
    const matchdayId = matchdayIdsByNumber.get(round.roundNumber);
    if (!matchdayId) {
      throw new Error(
        `ID giornata mancante per il turno ${round.roundNumber}.`
      );
    }

    return round.fixtures.map((fixture) => ({
      awayTeamId: fixture.awayTeamId,
      homeTeamId: fixture.homeTeamId,
      matchdayId,
      status: FantasyFixtureStatus.SCHEDULED
    }));
  });

  const createdMatchdayIds = matchdayRows.map((row) => row.id);

  try {
    // Plain writes — no interactive transaction. On failure, delete only the
    // matchday IDs this attempt created (avoids wiping a concurrent success).
    await db.matchday.createMany({
      data: matchdayRows
    });

    if (fixtureRows.length > 0) {
      await createManyInChunks(db, fixtureRows);
    }
  } catch (error) {
    await db.matchday.deleteMany({
      where: {
        id: {
          in: createdMatchdayIds
        }
      }
    });

    if (isUniqueConstraintError(error)) {
      const current = await inspectSchedule(db, league.id);
      if (
        current.matchdayCount === expectedMatchdayCount &&
        current.fixtureCount === expectedFixtureCount
      ) {
        throw new Error("Calendario già generato o giornate già presenti.");
      }
    }

    throw error;
  }

  const written = await inspectSchedule(db, league.id);
  if (
    written.matchdayCount !== expectedMatchdayCount ||
    written.fixtureCount !== expectedFixtureCount
  ) {
    await db.matchday.deleteMany({
      where: {
        id: {
          in: createdMatchdayIds
        }
      }
    });
    throw new Error(
      "Generazione calendario incompleta. Riprova: lo stato parziale è stato ripulito."
    );
  }

  return {
    byeCount,
    fixtureCount: expectedFixtureCount,
    matchdayCount: expectedMatchdayCount,
    mode: input.mode
  };
}

async function ensureScheduleWritable(
  db: PrismaClient,
  input: {
    expectedFixtureCount: number;
    expectedMatchdayCount: number;
    leagueId: string;
  }
) {
  const inspection = await inspectSchedule(db, input.leagueId);

  if (inspection.matchdayCount === 0 && inspection.fixtureCount === 0) {
    return;
  }

  const isComplete =
    inspection.matchdayCount === input.expectedMatchdayCount &&
    inspection.fixtureCount === input.expectedFixtureCount;

  if (isComplete) {
    throw new Error("Calendario già generato o giornate già presenti.");
  }

  if (inspection.hasProgressedWork) {
    throw new Error(
      "Calendario parziale con giornate già avviate: impossibile rigenerare automaticamente."
    );
  }

  // Incomplete DRAFT leftovers from a previous failed attempt — safe to wipe.
  await deleteDraftSchedule(db, input.leagueId);

  const afterCleanup = await inspectSchedule(db, input.leagueId);
  if (afterCleanup.matchdayCount > 0 || afterCleanup.fixtureCount > 0) {
    throw new Error(
      "Impossibile ripulire il calendario parziale. Controlla le giornate esistenti."
    );
  }
}

async function inspectSchedule(
  db: PrismaClient,
  leagueId: string
): Promise<ScheduleInspection> {
  const matchdays = await db.matchday.findMany({
    where: {
      leagueId
    },
    select: {
      id: true,
      status: true,
      _count: {
        select: {
          fixtures: true,
          lineups: true,
          playerVotes: true,
          requiredVotes: true,
          teamScores: true
        }
      }
    }
  });

  const fixtureCount = matchdays.reduce(
    (count, matchday) => count + matchday._count.fixtures,
    0
  );

  const hasNonDraftMatchday = matchdays.some(
    (matchday) => matchday.status !== MatchdayStatus.DRAFT
  );
  const hasRelatedWork = matchdays.some(
    (matchday) =>
      matchday._count.lineups > 0 ||
      matchday._count.playerVotes > 0 ||
      matchday._count.requiredVotes > 0 ||
      matchday._count.teamScores > 0
  );

  const progressedFixture = await db.fantasyFixture.findFirst({
    where: {
      matchday: {
        leagueId
      },
      status: {
        not: FantasyFixtureStatus.SCHEDULED
      }
    },
    select: {
      id: true
    }
  });

  return {
    fixtureCount,
    hasProgressedWork:
      hasNonDraftMatchday || hasRelatedWork || Boolean(progressedFixture),
    matchdayCount: matchdays.length
  };
}

async function deleteDraftSchedule(db: PrismaClient, leagueId: string) {
  // FantasyFixture cascades from Matchday.
  await db.matchday.deleteMany({
    where: {
      leagueId,
      status: MatchdayStatus.DRAFT
    }
  });
}

async function createManyInChunks(
  db: PrismaClient,
  rows: Array<{
    awayTeamId: string;
    homeTeamId: string;
    matchdayId: string;
    status: FantasyFixtureStatus;
  }>,
  chunkSize = 50
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await db.fantasyFixture.createMany({
      data: chunk,
      skipDuplicates: true
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
