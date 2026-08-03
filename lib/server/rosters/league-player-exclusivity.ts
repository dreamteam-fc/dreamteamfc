import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR =
  "Questo giocatore è già in un'altra squadra di questa lega.";

export async function assertPlayerFreeInLeague(
  options: {
    leagueId: string;
    playerId: string;
    exceptFantasyTeamId?: string;
  },
  db: DbClient = prisma
) {
  const existing = await db.fantasyRoster.findFirst({
    where: {
      leagueId: options.leagueId,
      playerId: options.playerId,
      ...(options.exceptFantasyTeamId
        ? {
            fantasyTeamId: {
              not: options.exceptFantasyTeamId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw new Error(PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR);
  }
}

export async function getRosteredPlayerIdsForLeague(
  leagueId: string,
  options?: {
    exceptFantasyTeamId?: string;
  },
  db: DbClient = prisma
) {
  const entries = await db.fantasyRoster.findMany({
    where: {
      leagueId,
      ...(options?.exceptFantasyTeamId
        ? {
            fantasyTeamId: {
              not: options.exceptFantasyTeamId
            }
          }
        : {})
    },
    select: {
      playerId: true
    }
  });

  return entries.map((entry) => entry.playerId);
}

export function isLeaguePlayerExclusivityConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  if (typeof target === "string") {
    return target.includes("leagueId") && target.includes("playerId");
  }

  if (Array.isArray(target)) {
    return target.includes("leagueId") && target.includes("playerId");
  }

  return false;
}
