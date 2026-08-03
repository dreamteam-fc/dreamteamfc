import { Prisma, type PlayerRole, type PrismaClient } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import {
  assertPlayerFreeInLeague,
  getRosteredPlayerIdsForLeague,
  isLeaguePlayerExclusivityConflict,
  PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR
} from "./league-player-exclusivity.ts";
import {
  REQUIRED_ROSTER_SIZE,
  validateRosterComposition
} from "./validate-roster-composition.ts";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AdminRosterMutationResult = {
  fantasyTeamId: string;
  leagueId: string;
  rosterCount: number;
};

async function assertPlayerAssignable(
  db: DbClient,
  options: {
    leagueId: string;
    playerId: string;
  }
) {
  const player = await db.player.findUnique({
    where: { id: options.playerId },
    select: {
      id: true,
      isActive: true,
      name: true,
      role: true
    }
  });

  if (!player || !player.isActive) {
    throw new Error("Giocatore non disponibile.");
  }

  const blockedPlayer = await db.leagueBlockedPlayer.findUnique({
    where: {
      leagueId_playerId: {
        leagueId: options.leagueId,
        playerId: player.id
      }
    },
    select: { id: true }
  });

  if (blockedPlayer) {
    throw new Error("Questo giocatore non e disponibile in questa lega.");
  }

  return player;
}

export async function adminAddPlayerToRoster(options: {
  fantasyTeamId: string;
  playerId: string;
}): Promise<AdminRosterMutationResult> {
  try {
    // Resolve league + assignability before opening an interactive transaction
    // so concurrent adds only hold a connection for exclusivity + create.
    const teamProbe = await prisma.fantasyTeam.findUnique({
      where: { id: options.fantasyTeamId },
      select: { id: true, leagueId: true }
    });

    if (!teamProbe) {
      throw new Error("Squadra non trovata.");
    }

    const player = await assertPlayerAssignable(prisma, {
      leagueId: teamProbe.leagueId,
      playerId: options.playerId
    });

    return await prisma.$transaction(
      async (tx) => {
        const team = await tx.fantasyTeam.findUnique({
          where: { id: options.fantasyTeamId },
          select: {
            id: true,
            leagueId: true,
            roster: {
              select: {
                playerId: true
              }
            }
          }
        });

        if (!team) {
          throw new Error("Squadra non trovata.");
        }

        if (team.roster.some((entry) => entry.playerId === player.id)) {
          throw new Error("Questo giocatore e gia presente nella rosa.");
        }

        await assertPlayerFreeInLeague(
          {
            leagueId: team.leagueId,
            playerId: player.id,
            exceptFantasyTeamId: team.id
          },
          tx
        );

        if (team.roster.length >= REQUIRED_ROSTER_SIZE) {
          throw new Error(
            `La rosa ha gia raggiunto il limite di ${REQUIRED_ROSTER_SIZE} giocatori.`
          );
        }

        await tx.fantasyRoster.create({
          data: {
            fantasyTeamId: team.id,
            leagueId: team.leagueId,
            playerId: player.id
          }
        });

        return {
          fantasyTeamId: team.id,
          leagueId: team.leagueId,
          rosterCount: team.roster.length + 1
        };
      },
      { maxWait: 8_000, timeout: 12_000 }
    );
  } catch (error) {
    if (isLeaguePlayerExclusivityConflict(error)) {
      throw new Error(PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Questo giocatore e gia presente nella rosa.");
    }

    throw error;
  }
}

export async function adminRemovePlayerFromRoster(options: {
  fantasyTeamId: string;
  playerId: string;
}): Promise<AdminRosterMutationResult> {
  return prisma.$transaction(async (tx) => {
    const team = await tx.fantasyTeam.findUnique({
      where: { id: options.fantasyTeamId },
      select: {
        id: true,
        leagueId: true,
        roster: {
          select: {
            id: true,
            playerId: true
          }
        }
      }
    });

    if (!team) {
      throw new Error("Squadra non trovata.");
    }

    const rosterEntry = team.roster.find(
      (entry) => entry.playerId === options.playerId
    );

    if (!rosterEntry) {
      throw new Error("Il giocatore non e presente nella rosa.");
    }

    await tx.fantasyRoster.delete({
      where: { id: rosterEntry.id }
    });

    return {
      fantasyTeamId: team.id,
      leagueId: team.leagueId,
      rosterCount: team.roster.length - 1
    };
  });
}

export async function adminReplacePlayerInRoster(options: {
  fantasyTeamId: string;
  incomingPlayerId: string;
  outgoingPlayerId: string;
}): Promise<AdminRosterMutationResult> {
  if (options.incomingPlayerId === options.outgoingPlayerId) {
    throw new Error("Seleziona due giocatori diversi per la sostituzione.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.fantasyTeam.findUnique({
        where: { id: options.fantasyTeamId },
        select: {
          id: true,
          leagueId: true,
          roster: {
            select: {
              id: true,
              playerId: true,
              player: {
                select: {
                  id: true,
                  role: true
                }
              }
            }
          }
        }
      });

      if (!team) {
        throw new Error("Squadra non trovata.");
      }

      const outgoing = team.roster.find(
        (entry) => entry.playerId === options.outgoingPlayerId
      );

      if (!outgoing) {
        throw new Error("Il giocatore da sostituire non e in rosa.");
      }

      if (
        team.roster.some((entry) => entry.playerId === options.incomingPlayerId)
      ) {
        throw new Error("Il nuovo giocatore e gia presente nella rosa.");
      }

      const incoming = await assertPlayerAssignable(tx, {
        leagueId: team.leagueId,
        playerId: options.incomingPlayerId
      });

      if (incoming.role !== outgoing.player.role) {
        throw new Error(
          "La sostituzione admin deve mantenere lo stesso ruolo (3P/8D/8C/6A)."
        );
      }

      await assertPlayerFreeInLeague(
        {
          leagueId: team.leagueId,
          playerId: incoming.id,
          exceptFantasyTeamId: team.id
        },
        tx
      );

      await tx.fantasyRoster.delete({
        where: { id: outgoing.id }
      });

      await tx.fantasyRoster.create({
        data: {
          fantasyTeamId: team.id,
          leagueId: team.leagueId,
          playerId: incoming.id
        }
      });

      return {
        fantasyTeamId: team.id,
        leagueId: team.leagueId,
        rosterCount: team.roster.length
      };
    });
  } catch (error) {
    if (isLeaguePlayerExclusivityConflict(error)) {
      throw new Error(PLAYER_ALREADY_IN_LEAGUE_ROSTER_ERROR);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Il nuovo giocatore e gia presente nella rosa.");
    }

    throw error;
  }
}

export async function getAdminTeamRosterData(
  fantasyTeamId: string,
  options?: {
    roleFilter?: "ALL" | PlayerRole;
    searchQuery?: string;
  }
) {
  const roleFilter = options?.roleFilter ?? "ALL";
  const normalizedSearchQuery = options?.searchQuery?.trim() ?? "";

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: fantasyTeamId },
    select: {
      id: true,
      leagueId: true,
      name: true,
      roster: {
        orderBy: [{ player: { role: "asc" } }, { player: { name: "asc" } }],
        select: {
          id: true,
          playerId: true,
          player: {
            select: {
              id: true,
              isActive: true,
              name: true,
              role: true,
              teamName: true
            }
          }
        }
      }
    }
  });

  if (!team) {
    return null;
  }

  const [blockedRosterPlayers, blockedLeaguePlayers, league, leagueRosteredIds] =
    await Promise.all([
      prisma.leagueBlockedPlayer.findMany({
        where: {
          leagueId: team.leagueId,
          playerId: {
            in: team.roster.map((entry) => entry.playerId)
          }
        },
        select: { playerId: true }
      }),
      prisma.leagueBlockedPlayer.findMany({
        where: { leagueId: team.leagueId },
        select: { playerId: true }
      }),
      prisma.league.findUnique({
        where: { id: team.leagueId },
        select: {
          id: true,
          name: true
        }
      }),
      getRosteredPlayerIdsForLeague(team.leagueId)
    ]);

  const blockedRosterIds = new Set(
    blockedRosterPlayers.map((entry) => entry.playerId)
  );
  const blockedLeagueIds = new Set(
    blockedLeaguePlayers.map((entry) => entry.playerId)
  );
  const leagueRosteredPlayerIds = new Set(leagueRosteredIds);

  const rosterWithFlags = team.roster.map((entry) => ({
    ...entry,
    player: {
      ...entry.player,
      isBlockedInLeague: blockedRosterIds.has(entry.player.id),
      isUnavailable:
        blockedRosterIds.has(entry.player.id) || !entry.player.isActive
    }
  }));

  const availablePlayers = await prisma.player.findMany({
    where: {
      isActive: true,
      id: {
        notIn: [...leagueRosteredPlayerIds, ...blockedLeagueIds]
      },
      ...(roleFilter === "ALL" ? {} : { role: roleFilter }),
      ...(normalizedSearchQuery.length > 0
        ? {
            name: {
              contains: normalizedSearchQuery,
              mode: "insensitive" as const
            }
          }
        : {})
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: 80,
    select: {
      id: true,
      name: true,
      role: true,
      teamName: true
    }
  });

  return {
    availablePlayers,
    league,
    rosterValidation: validateRosterComposition(
      rosterWithFlags.map((entry) => ({
        isBlockedInLeague: entry.player.isBlockedInLeague,
        isGloballyInactive: !entry.player.isActive,
        role: entry.player.role
      }))
    ),
    searchQuery: normalizedSearchQuery,
    team: {
      id: team.id,
      name: team.name,
      leagueId: team.leagueId,
      roster: rosterWithFlags
    }
  };
}
