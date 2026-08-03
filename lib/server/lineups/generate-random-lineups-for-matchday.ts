import {
  LineupStatus,
  PlayerRole,
  Prisma,
  SlotType,
  type PrismaClient
} from "@prisma/client";

import { getBenchPositionOrderByRole } from "../../lineups/bench-position-order.ts";
import { prisma as defaultPrisma } from "../../prisma.ts";
import {
  REQUIRED_TOTAL_LINEUP_PLAYERS,
  validateLineupComposition
} from "./validate-lineup-composition.ts";

type DbClient = PrismaClient | Prisma.TransactionClient;

type RoleCounts = Record<PlayerRole, number>;

export type RosterPlayerForLineup = {
  id: string;
  name: string;
  role: PlayerRole;
  isActive: boolean;
};

export type GenerateRandomLineupsOptions = {
  /** Optional Prisma client (scripts may pass a dedicated instance). */
  db?: PrismaClient;
  /**
   * When false, skip teams that already have a SUBMITTED lineup with 9 players.
   * Admin UI always uses force=true.
   */
  force?: boolean;
  /** Limit generation to these fantasy team ids (same league only). */
  fantasyTeamIds?: string[];
  leagueId: string;
  matchdayId: string;
};

export type GenerateRandomLineupsResult = {
  failures: Array<{ error: string; teamId: string; teamName: string }>;
  leagueId: string;
  matchdayId: string;
  matchdayNumber: number;
  skipped: number;
  written: number;
};

const OUTFIELD_ROLES = [
  PlayerRole.DEFENDER,
  PlayerRole.MIDFIELDER,
  PlayerRole.ATTACKER
] as const;

/** Valid starter outfield shapes: 1P + 4 with min 1D/1C/1A (extra slot free). */
const STARTER_OUTFIELD_SHAPES: ReadonlyArray<
  Record<(typeof OUTFIELD_ROLES)[number], number>
> = [
  {
    [PlayerRole.DEFENDER]: 2,
    [PlayerRole.MIDFIELDER]: 1,
    [PlayerRole.ATTACKER]: 1
  },
  {
    [PlayerRole.DEFENDER]: 1,
    [PlayerRole.MIDFIELDER]: 2,
    [PlayerRole.ATTACKER]: 1
  },
  {
    [PlayerRole.DEFENDER]: 1,
    [PlayerRole.MIDFIELDER]: 1,
    [PlayerRole.ATTACKER]: 2
  }
];

const BENCH_COUNTS: RoleCounts = {
  [PlayerRole.GOALKEEPER]: 1,
  [PlayerRole.DEFENDER]: 1,
  [PlayerRole.MIDFIELDER]: 1,
  [PlayerRole.ATTACKER]: 1
};

function emptyRoleCounts(): RoleCounts {
  return {
    [PlayerRole.GOALKEEPER]: 0,
    [PlayerRole.DEFENDER]: 0,
    [PlayerRole.MIDFIELDER]: 0,
    [PlayerRole.ATTACKER]: 0
  };
}

function shuffleInPlace<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = values[index]!;
    values[index] = values[swapIndex]!;
    values[swapIndex] = current;
  }
  return values;
}

function countActiveByRole(roster: RosterPlayerForLineup[]): RoleCounts {
  const counts = emptyRoleCounts();
  for (const player of roster) {
    if (player.isActive) {
      counts[player.role] += 1;
    }
  }
  return counts;
}

function starterCountsFromOutfieldShape(
  outfield: Record<(typeof OUTFIELD_ROLES)[number], number>
): RoleCounts {
  return {
    [PlayerRole.GOALKEEPER]: 1,
    [PlayerRole.DEFENDER]: outfield[PlayerRole.DEFENDER],
    [PlayerRole.MIDFIELDER]: outfield[PlayerRole.MIDFIELDER],
    [PlayerRole.ATTACKER]: outfield[PlayerRole.ATTACKER]
  };
}

function compositionFitsRoster(
  starterCounts: RoleCounts,
  available: RoleCounts
): boolean {
  for (const role of [
    PlayerRole.GOALKEEPER,
    PlayerRole.DEFENDER,
    PlayerRole.MIDFIELDER,
    PlayerRole.ATTACKER
  ] as const) {
    if (available[role] < starterCounts[role] + BENCH_COUNTS[role]) {
      return false;
    }
  }
  return true;
}

function pickByRoleCounts(
  roster: RosterPlayerForLineup[],
  counts: RoleCounts,
  usedPlayerIds: Set<string>
): RosterPlayerForLineup[] {
  const picked: RosterPlayerForLineup[] = [];

  for (const role of [
    PlayerRole.GOALKEEPER,
    PlayerRole.DEFENDER,
    PlayerRole.MIDFIELDER,
    PlayerRole.ATTACKER
  ] as const) {
    const needed = counts[role];
    if (needed <= 0) {
      continue;
    }

    const available = shuffleInPlace(
      roster.filter(
        (player) =>
          player.role === role &&
          player.isActive &&
          !usedPlayerIds.has(player.id)
      )
    );

    if (available.length < needed) {
      throw new Error(
        `Rosa insufficiente per ruolo ${role}: servono ${needed}, disponibili ${available.length}.`
      );
    }

    for (let index = 0; index < needed; index += 1) {
      const player = available[index]!;
      picked.push(player);
      usedPlayerIds.add(player.id);
    }
  }

  return picked;
}

function orderStartersByRole(
  starters: RosterPlayerForLineup[]
): RosterPlayerForLineup[] {
  return [
    ...starters.filter((player) => player.role === PlayerRole.GOALKEEPER),
    ...starters.filter((player) => player.role === PlayerRole.DEFENDER),
    ...starters.filter((player) => player.role === PlayerRole.MIDFIELDER),
    ...starters.filter((player) => player.role === PlayerRole.ATTACKER)
  ];
}

/**
 * Builds a random valid lineup (5 starters + 4 bench) from a roster.
 * Throws if the roster cannot satisfy composition rules.
 */
export function buildRandomValidLineupFromRoster(
  roster: RosterPlayerForLineup[]
): {
  bench: RosterPlayerForLineup[];
  starters: RosterPlayerForLineup[];
} {
  const available = countActiveByRole(roster);
  const fittingShapes = STARTER_OUTFIELD_SHAPES.filter((shape) =>
    compositionFitsRoster(starterCountsFromOutfieldShape(shape), available)
  );

  if (fittingShapes.length === 0) {
    throw new Error(
      "Rosa insufficiente per una formazione valida (servono almeno 2P e abbastanza D/C/A per 5 titolari + panchina 1P1D1C1A)."
    );
  }

  const chosenShape =
    fittingShapes[Math.floor(Math.random() * fittingShapes.length)]!;
  const starterCounts = starterCountsFromOutfieldShape(chosenShape);
  const usedPlayerIds = new Set<string>();
  const starters = orderStartersByRole(
    pickByRoleCounts(roster, starterCounts, usedPlayerIds)
  );
  const bench = pickByRoleCounts(roster, BENCH_COUNTS, usedPlayerIds);

  const validation = validateLineupComposition(starters, bench);
  if (!validation.isValid) {
    throw new Error(validation.errors[0] ?? "Formazione non valida.");
  }

  return { bench, starters };
}

async function persistSubmittedLineup(
  db: DbClient,
  options: {
    existingLineupId: string | null;
    fantasyTeamId: string;
    matchdayId: string;
    starters: RosterPlayerForLineup[];
    bench: RosterPlayerForLineup[];
  }
) {
  const lineup = options.existingLineupId
    ? await db.lineup.update({
        where: { id: options.existingLineupId },
        data: {
          status: LineupStatus.SUBMITTED,
          submittedAt: new Date()
        },
        select: { id: true }
      })
    : await db.lineup.create({
        data: {
          fantasyTeamId: options.fantasyTeamId,
          matchdayId: options.matchdayId,
          status: LineupStatus.SUBMITTED,
          submittedAt: new Date()
        },
        select: { id: true }
      });

  await db.lineupPlayer.deleteMany({
    where: { lineupId: lineup.id }
  });

  await db.lineupPlayer.createMany({
    data: [
      ...options.starters.map((player, index) => ({
        lineupId: lineup.id,
        playerId: player.id,
        positionOrder: index + 1,
        slotType: SlotType.STARTER
      })),
      ...[...options.bench]
        .sort(
          (left, right) =>
            getBenchPositionOrderByRole(left.role) -
            getBenchPositionOrderByRole(right.role)
        )
        .map((player) => ({
          lineupId: lineup.id,
          playerId: player.id,
          positionOrder: getBenchPositionOrderByRole(player.role),
          slotType: SlotType.BENCH
        }))
    ]
  });
}

/**
 * Writes random valid SUBMITTED lineups for fantasy teams in one league matchday.
 * Only touches the given leagueId + matchdayId (and optional team filter).
 */
export async function generateRandomLineupsForMatchday(
  options: GenerateRandomLineupsOptions
): Promise<GenerateRandomLineupsResult> {
  const db = options.db ?? defaultPrisma;
  const force = options.force ?? true;

  const matchday = await db.matchday.findFirst({
    where: {
      id: options.matchdayId,
      leagueId: options.leagueId
    },
    select: {
      id: true,
      number: true,
      leagueId: true
    }
  });

  if (!matchday) {
    throw new Error("Giornata non trovata per questa lega.");
  }

  const teams = await db.fantasyTeam.findMany({
    where: {
      leagueId: options.leagueId,
      ...(options.fantasyTeamIds && options.fantasyTeamIds.length > 0
        ? { id: { in: options.fantasyTeamIds } }
        : {})
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      roster: {
        select: {
          player: {
            select: {
              id: true,
              name: true,
              role: true,
              isActive: true
            }
          }
        }
      }
    }
  });

  if (teams.length === 0) {
    throw new Error("Nessuna squadra trovata nella lega.");
  }

  let written = 0;
  let skipped = 0;
  const failures: GenerateRandomLineupsResult["failures"] = [];

  for (const team of teams) {
    try {
      const existing = await db.lineup.findUnique({
        where: {
          fantasyTeamId_matchdayId: {
            fantasyTeamId: team.id,
            matchdayId: matchday.id
          }
        },
        select: {
          id: true,
          status: true,
          _count: { select: { players: true } }
        }
      });

      if (
        !force &&
        existing &&
        existing.status === LineupStatus.SUBMITTED &&
        existing._count.players === REQUIRED_TOTAL_LINEUP_PLAYERS
      ) {
        skipped += 1;
        continue;
      }

      const roster: RosterPlayerForLineup[] = team.roster.map(
        (entry) => entry.player
      );
      const { starters, bench } = buildRandomValidLineupFromRoster(roster);

      await db.$transaction(async (tx) => {
        await persistSubmittedLineup(tx, {
          existingLineupId: existing?.id ?? null,
          fantasyTeamId: team.id,
          matchdayId: matchday.id,
          starters,
          bench
        });
      });

      written += 1;
    } catch (error) {
      failures.push({
        teamId: team.id,
        teamName: team.name,
        error: error instanceof Error ? error.message : "Errore sconosciuto"
      });
    }
  }

  return {
    failures,
    leagueId: matchday.leagueId,
    matchdayId: matchday.id,
    matchdayNumber: matchday.number,
    skipped,
    written
  };
}
