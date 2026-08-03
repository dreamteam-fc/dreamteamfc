import { randomUUID } from "node:crypto";

import {
  TournamentFixtureStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  buildRoundPlans,
  pairFirstRoundAvoidingSameLeague,
  rankSeedCandidates
} from "@/lib/tournaments/pair-seeds.ts";
import {
  ALLOWED_BRACKET_SIZES_LABEL,
  isAllowedBracketSize
} from "@/lib/tournaments/bracket-size.ts";

/**
 * Bracket generation must NOT use a long interactive `$transaction`.
 *
 * On Supabase PgBouncer (Transaction :6543 and often Session :5432 under load),
 * Prisma interactive transactions drop mid-flight with:
 *   "Transaction not found. Transaction ID is invalid..."
 *
 * Durable approach (same as calendar / required-vote / score calc): precompute
 * in memory, wipe incomplete leftovers, then write with plain createMany /
 * update — no interactive tx spanning rounds + fixtures.
 */
export async function generateTournamentBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      entries: {
        select: {
          id: true,
          fantasyTeamId: true,
          seedPoints: true,
          sourceLeagueId: true,
          fantasyTeam: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (!tournament) {
    throw new Error("Torneo non trovato.");
  }

  if (tournament.status !== TournamentStatus.ENTRIES_SET) {
    throw new Error(
      "Genera il tabellone solo dopo aver salvato il roster (stato: squadre selezionate)."
    );
  }

  if (!isAllowedBracketSize(tournament.entries.length)) {
    throw new Error(
      `Il roster deve avere ${ALLOWED_BRACKET_SIZES_LABEL} squadre.`
    );
  }

  const seeded = rankSeedCandidates(
    tournament.entries.map((entry) => ({
      entryId: entry.id,
      fantasyTeamId: entry.fantasyTeamId,
      leagueId: entry.sourceLeagueId,
      name: entry.fantasyTeam.name,
      seedPoints: entry.seedPoints
    }))
  );

  const firstRoundPairs = pairFirstRoundAvoidingSameLeague(seeded);
  const roundPlans = buildRoundPlans(seeded.length);

  const expectedRoundCount = roundPlans.length;
  const expectedFixtureCount = roundPlans.reduce((count, plan) => {
    const legs = plan.twoLegs ? 2 : 1;
    return count + plan.bracketSlots * legs;
  }, 0);

  await ensureBracketWritable(tournament.id, {
    expectedFixtureCount,
    expectedRoundCount
  });

  const roundIdByIndex = new Map<number, string>();
  const roundRows = roundPlans.map((plan) => {
    const id = randomUUID();
    roundIdByIndex.set(plan.roundIndex, id);
    return {
      id,
      isFinal: plan.isFinal,
      name: plan.name,
      roundIndex: plan.roundIndex,
      tournamentId: tournament.id
    };
  });

  const fixtureRows = roundPlans.flatMap((plan) => {
    const roundId = roundIdByIndex.get(plan.roundIndex);
    if (!roundId) {
      throw new Error(`ID fase mancante per roundIndex ${plan.roundIndex}.`);
    }

    const rows: Array<{
      awayTeamId: string | null;
      bracketSlot: number;
      homeTeamId: string | null;
      leg: number;
      roundId: string;
      seriesKey: string;
      status: TournamentFixtureStatus;
    }> = [];

    for (let slot = 0; slot < plan.bracketSlots; slot += 1) {
      const seriesKey = `${plan.roundIndex}-${slot}`;
      const legs = plan.twoLegs ? [1, 2] : [1];

      for (const leg of legs) {
        let homeTeamId: string | null = null;
        let awayTeamId: string | null = null;
        let status: TournamentFixtureStatus = TournamentFixtureStatus.SCHEDULED;

        if (plan.roundIndex === 0) {
          const pair = firstRoundPairs[slot];
          // Leg 1: home = seed alto; leg 2: campi invertiti
          if (leg === 1) {
            homeTeamId = pair.home.fantasyTeamId;
            awayTeamId = pair.away.fantasyTeamId;
          } else {
            homeTeamId = pair.away.fantasyTeamId;
            awayTeamId = pair.home.fantasyTeamId;
          }
          status = TournamentFixtureStatus.READY;
        }

        rows.push({
          awayTeamId,
          bracketSlot: slot,
          homeTeamId,
          leg,
          roundId,
          seriesKey,
          status
        });
      }
    }

    return rows;
  });

  const createdRoundIds = roundRows.map((row) => row.id);

  try {
    // Plain writes — no interactive transaction. On failure, delete only the
    // round IDs this attempt created (cascades fixtures).
    for (const seededTeam of seeded) {
      await prisma.tournamentTeamEntry.update({
        where: { id: seededTeam.entryId },
        data: { seedRank: seededTeam.seedRank }
      });
    }

    await prisma.tournamentRound.createMany({
      data: roundRows
    });

    if (fixtureRows.length > 0) {
      await createManyFixturesInChunks(fixtureRows);
    }

    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        status: TournamentStatus.BRACKET_GENERATED
      }
    });
  } catch (error) {
    await prisma.tournamentRound.deleteMany({
      where: {
        id: {
          in: createdRoundIds
        }
      }
    });

    if (isUniqueConstraintError(error)) {
      const current = await inspectBracket(tournament.id);
      if (
        current.roundCount === expectedRoundCount &&
        current.fixtureCount === expectedFixtureCount
      ) {
        throw new Error("Il tabellone e gia stato generato.");
      }
    }

    throw error;
  }

  const written = await inspectBracket(tournament.id);
  if (
    written.roundCount !== expectedRoundCount ||
    written.fixtureCount !== expectedFixtureCount
  ) {
    await prisma.tournamentRound.deleteMany({
      where: {
        id: {
          in: createdRoundIds
        }
      }
    });
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        status: TournamentStatus.ENTRIES_SET
      }
    });
    throw new Error(
      "Generazione tabellone incompleta. Riprova: lo stato parziale e stato ripulito."
    );
  }

  return {
    name: tournament.name,
    pairs: firstRoundPairs.length,
    rounds: roundPlans.length,
    tournamentId: tournament.id
  };
}

type BracketInspection = {
  fixtureCount: number;
  hasProgressedWork: boolean;
  roundCount: number;
};

async function ensureBracketWritable(
  tournamentId: string,
  expected: {
    expectedFixtureCount: number;
    expectedRoundCount: number;
  }
) {
  const inspection = await inspectBracket(tournamentId);

  if (inspection.roundCount === 0 && inspection.fixtureCount === 0) {
    return;
  }

  const isComplete =
    inspection.roundCount === expected.expectedRoundCount &&
    inspection.fixtureCount === expected.expectedFixtureCount;

  if (isComplete) {
    throw new Error("Il tabellone e gia stato generato.");
  }

  if (inspection.hasProgressedWork) {
    throw new Error(
      "Tabellone parziale con partite o voti gia avviati: impossibile rigenerare automaticamente."
    );
  }

  // Incomplete leftovers from a previous failed attempt — safe to wipe.
  await prisma.tournamentRound.deleteMany({
    where: { tournamentId }
  });

  const afterCleanup = await inspectBracket(tournamentId);
  if (afterCleanup.roundCount > 0 || afterCleanup.fixtureCount > 0) {
    throw new Error(
      "Impossibile ripulire il tabellone parziale. Controlla le fasi esistenti."
    );
  }
}

async function inspectBracket(
  tournamentId: string
): Promise<BracketInspection> {
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    select: {
      id: true,
      _count: {
        select: {
          fixtures: true,
          playerVotes: true,
          requiredVotes: true
        }
      }
    }
  });

  const fixtureCount = rounds.reduce(
    (count, round) => count + round._count.fixtures,
    0
  );
  const hasRelatedVotes = rounds.some(
    (round) =>
      round._count.playerVotes > 0 || round._count.requiredVotes > 0
  );

  const progressedFixture = await prisma.tournamentFixture.findFirst({
    where: {
      round: { tournamentId },
      OR: [
        { status: TournamentFixtureStatus.COMPLETED },
        { lineups: { some: {} } }
      ]
    },
    select: { id: true }
  });

  return {
    fixtureCount,
    hasProgressedWork: hasRelatedVotes || Boolean(progressedFixture),
    roundCount: rounds.length
  };
}

async function createManyFixturesInChunks(
  rows: Array<{
    awayTeamId: string | null;
    bracketSlot: number;
    homeTeamId: string | null;
    leg: number;
    roundId: string;
    seriesKey: string;
    status: TournamentFixtureStatus;
  }>,
  chunkSize = 50
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await prisma.tournamentFixture.createMany({
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

export async function getTournamentBracketPageData(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      lineupsOpen: true,
      entries: {
        orderBy: [{ seedRank: "asc" }, { seedPoints: "desc" }],
        select: {
          activatedAt: true,
          fantasyTeamId: true,
          seedPoints: true,
          seedRank: true,
          sourceLeague: {
            select: {
              name: true
            }
          },
          fantasyTeam: {
            select: {
              name: true
            }
          }
        }
      },
      rounds: {
        orderBy: { roundIndex: "asc" },
        select: {
          id: true,
          isFinal: true,
          name: true,
          roundIndex: true,
          requiredVotes: {
            select: {
              status: true
            }
          },
          _count: {
            select: {
              playerVotes: true
            }
          },
          fixtures: {
            orderBy: [{ bracketSlot: "asc" }, { leg: "asc" }],
            select: {
              id: true,
              awayGoals: true,
              awayTeamId: true,
              bracketSlot: true,
              homeGoals: true,
              homeTeamId: true,
              leg: true,
              seriesKey: true,
              status: true,
              awayTeam: {
                select: {
                  id: true,
                  name: true
                }
              },
              homeTeam: {
                select: {
                  id: true,
                  name: true
                }
              },
              lineups: {
                select: {
                  fantasyTeamId: true,
                  status: true,
                  fantasyTeam: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return tournament;
}
