import { MatchdayStatus, UserRole } from "@prisma/client";

import { hasLeagueScheduleGenerated } from "@/lib/server/leagues/has-league-schedule-generated.ts";
import { prisma } from "@/lib/prisma.ts";
import type { PlayerRoleFilter } from "@/lib/players/player-role.ts";
import { validateLineupComposition } from "@/lib/server/lineups/validate-lineup-composition.ts";
import { getBlockedPlayerIdsForLeague } from "@/lib/server/players/league-blocked-players.ts";
import { getRosteredPlayerIdsForLeague } from "@/lib/server/rosters/league-player-exclusivity.ts";
import { validateRosterComposition } from "@/lib/server/rosters/validate-roster-composition.ts";

type AppUserAccessContext = {
  appUser: {
    id: string;
    role: UserRole;
  };
};

export async function getUserDashboardData(appUserId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: appUserId
    },
    select: {
      displayName: true,
      email: true,
      fantasyTeams: {
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        select: {
          id: true,
          logoPath: true,
          name: true,
          leagueId: true,
          updatedAt: true,
          league: {
            select: {
              id: true,
              matchdays: {
                where: {
                  status: MatchdayStatus.LINEUPS_OPEN
                },
                orderBy: [{ number: "asc" }],
                select: {
                  id: true,
                  number: true,
                  status: true
                }
              },
              name: true
            }
          },
          lineups: {
            where: {
              matchday: {
                status: MatchdayStatus.LINEUPS_OPEN
              }
            },
            select: {
              id: true,
              matchdayId: true,
              status: true,
              submittedAt: true
            }
          }
        }
      },
      id: true,
      leagueMembers: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          role: true,
          league: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      role: true,
      teamCoaching: {
        where: {
          revokedAt: null
        },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          fantasyTeam: {
            select: {
              id: true,
              logoPath: true,
              name: true,
              leagueId: true,
              updatedAt: true,
              league: {
                select: {
                  id: true,
                  name: true,
                  matchdays: {
                    where: {
                      status: MatchdayStatus.LINEUPS_OPEN
                    },
                    orderBy: [{ number: "asc" }],
                    select: {
                      id: true,
                      number: true,
                      status: true
                    }
                  }
                }
              },
              lineups: {
                where: {
                  matchday: {
                    status: MatchdayStatus.LINEUPS_OPEN
                  }
                },
                select: {
                  id: true,
                  matchdayId: true
                }
              },
              user: {
                select: {
                  displayName: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  const leaguesMap = new Map<
    string,
    {
      id: string;
      membershipRole: string | null;
      myTeam: { id: string; name: string } | null;
      name: string;
    }
  >();

  for (const membership of user.leagueMembers) {
    leaguesMap.set(membership.league.id, {
      id: membership.league.id,
      membershipRole: membership.role,
      myTeam: null,
      name: membership.league.name
    });
  }

  for (const team of user.fantasyTeams) {
    const existing = leaguesMap.get(team.league.id);
    leaguesMap.set(team.league.id, {
      id: team.league.id,
      membershipRole: existing?.membershipRole ?? null,
      myTeam: {
        id: team.id,
        name: team.name
      },
      name: team.league.name
    });
  }

  const myTeams = user.fantasyTeams.map((team) => ({
    id: team.id,
    league: team.league,
    leagueId: team.leagueId,
    logoPath: team.logoPath,
    name: team.name,
    openMatchdays: team.league.matchdays.map((matchday) => ({
      ...matchday,
      hasLineup: team.lineups.some((lineup) => lineup.matchdayId === matchday.id)
    })),
    updatedAt: team.updatedAt
  }));

  const coachedTeams = user.teamCoaching.map((entry) => {
    const team = entry.fantasyTeam;
    return {
      id: team.id,
      league: team.league,
      leagueId: team.leagueId,
      logoPath: team.logoPath,
      name: team.name,
      owner: team.user,
      openMatchdays: team.league.matchdays.map((matchday) => ({
        ...matchday,
        hasLineup: team.lineups.some((lineup) => lineup.matchdayId === matchday.id)
      })),
      updatedAt: team.updatedAt
    };
  });

  return {
    coachedTeams,
    leagues: Array.from(leaguesMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "it")
    ),
    myTeams,
    user
  };
}

export async function getLeagueJoinPageData(leagueId: string, appUserId: string) {
  const [league, existingLeagueTeam, scheduleGenerated] = await Promise.all([
    prisma.league.findUnique({
      where: {
        id: leagueId
      },
      select: {
        id: true,
        maxTeams: true,
        name: true,
        status: true,
        _count: {
          select: {
            fantasyTeams: true,
            members: true
          }
        }
      }
    }),
    prisma.fantasyTeam.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: appUserId
        }
      },
      select: {
        id: true,
        league: {
          select: {
            id: true,
            name: true
          }
        },
        name: true
      }
    }),
    hasLeagueScheduleGenerated(leagueId)
  ]);

  if (!league) {
    return null;
  }

  return {
    canJoin:
      !existingLeagueTeam &&
      league._count.fantasyTeams < league.maxTeams &&
      !scheduleGenerated,
    existingLeagueTeam,
    isFull: league._count.fantasyTeams >= league.maxTeams,
    league,
    scheduleGenerated
  };
}

export async function getUserTeamPageData(teamId: string) {
  const team = await prisma.fantasyTeam.findUnique({
    where: {
      id: teamId
    },
    select: {
      _count: {
        select: {
          awayFixtures: true,
          homeFixtures: true,
          lineups: true,
          teamScores: true
        }
      },
      id: true,
      league: {
        select: {
          id: true,
          matchdays: {
            orderBy: [{ number: "asc" }],
            select: {
              fixtures: {
                where: {
                  OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
                },
                select: {
                  awayGoals: true,
                  awayTeam: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  homeGoals: true,
                  homeTeam: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  id: true,
                  status: true
                }
              },
              id: true,
              lineupDeadlineAt: true,
              number: true,
              status: true
            }
          },
          name: true
        }
      },
      leagueId: true,
      lineups: {
        select: {
          id: true,
          matchdayId: true,
          status: true,
          submittedAt: true
        }
      },
      logoPath: true,
      name: true,
      updatedAt: true,
      roster: {
        orderBy: [{ player: { role: "asc" } }, { player: { name: "asc" } }],
        select: {
          id: true,
          player: {
            select: {
              id: true,
              isActive: true,
              name: true,
              role: true,
              source: true,
              teamName: true
            }
          }
        }
      },
      userId: true
    }
  });

  if (!team) {
    return null;
  }

  const blockedPlayerIds = new Set(
    await getBlockedPlayerIdsForLeague(team.leagueId)
  );

  const hasParticipationHistory =
    team._count.lineups > 0 ||
    team._count.teamScores > 0 ||
    team._count.homeFixtures > 0 ||
    team._count.awayFixtures > 0;
  const leagueScheduleGenerated = await hasLeagueScheduleGenerated(team.leagueId);

  return {
    ...team,
    canLeaveLeague: !hasParticipationHistory && !leagueScheduleGenerated,
    hasParticipationHistory,
    leagueScheduleGenerated,
    roster: team.roster.map((entry) => ({
      ...entry,
      player: {
        ...entry.player,
        isBlockedInLeague: blockedPlayerIds.has(entry.player.id)
      }
    })),
    nextMatchday:
      team.league.matchdays.find(
        (matchday) =>
          matchday.status !== MatchdayStatus.PUBLISHED &&
          matchday.status !== MatchdayStatus.LOCKED
      ) ?? null
  };
}

export async function getUserTeamRosterPageData(
  teamId: string,
  roleFilter: PlayerRoleFilter,
  searchQuery?: string
) {
  const normalizedSearchQuery = searchQuery?.trim() ?? "";
  const team = await getUserTeamPageData(teamId);

  if (!team) {
    return null;
  }

  const [blockedPlayerIds, leagueRosteredPlayerIds] = await Promise.all([
    getBlockedPlayerIdsForLeague(team.leagueId),
    getRosteredPlayerIdsForLeague(team.leagueId)
  ]);
  const excludedPlayerIds = new Set([
    ...blockedPlayerIds,
    ...leagueRosteredPlayerIds
  ]);
  const [activePlayersCount, availablePlayers] = await Promise.all([
    prisma.player.count({
      where: {
        isActive: true
      }
    }),
    prisma.player.findMany({
      where: {
        id: {
          notIn: [...excludedPlayerIds]
        },
        isActive: true,
        ...(normalizedSearchQuery.length > 0
          ? {
              name: {
                contains: normalizedSearchQuery,
                mode: "insensitive"
              }
            }
          : {}),
        ...(roleFilter === "ALL" ? {} : { role: roleFilter })
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        source: true,
        teamName: true
      }
    })
  ]);

  return {
    activePlayersCount,
    availablePlayers: availablePlayers.map((player) => ({
      ...player,
      isSelected: false
    })),
    searchQuery: normalizedSearchQuery,
    rosterValidation: validateRosterComposition(
      team.roster.map((entry) => ({
        isBlockedInLeague: entry.player.isBlockedInLeague,
        isGloballyInactive: !entry.player.isActive,
        role: entry.player.role
      }))
    ),
    team
  };
}

export async function getUserLineupPageData(
  teamId: string,
  matchdayId: string,
  authContext: AppUserAccessContext
) {
  const team = await prisma.fantasyTeam.findUnique({
    where: {
      id: teamId
    },
    select: {
      id: true,
      league: {
        select: {
          id: true,
          name: true
        }
      },
      leagueId: true,
      name: true,
      roster: {
        orderBy: [{ player: { role: "asc" } }, { player: { name: "asc" } }],
        select: {
          id: true,
          player: {
            select: {
              id: true,
              isActive: true,
              name: true,
              role: true,
              source: true,
              teamName: true
            }
          }
        }
      },
      userId: true
    }
  });

  if (!team) {
    return null;
  }

  const canAccess =
    authContext.appUser.role === UserRole.ADMIN ||
    authContext.appUser.id === team.userId ||
    Boolean(
      await prisma.teamCoach.findFirst({
        where: {
          fantasyTeamId: teamId,
          userId: authContext.appUser.id,
          revokedAt: null
        },
        select: { id: true }
      })
    );

  if (!canAccess) {
    return {
      accessDenied: true as const,
      team
    };
  }

  const matchday = await prisma.matchday.findUnique({
    where: {
      id: matchdayId
    },
    select: {
      id: true,
      leagueId: true,
      lineupDeadlineAt: true,
      number: true,
      status: true
    }
  });

  if (!matchday || matchday.leagueId !== team.leagueId) {
    return null;
  }

  const existingLineup = await prisma.lineup.findUnique({
    where: {
      fantasyTeamId_matchdayId: {
        fantasyTeamId: teamId,
        matchdayId
      }
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      players: {
        orderBy: [{ slotType: "asc" }, { positionOrder: "asc" }],
        select: {
          id: true,
          playerId: true,
          positionOrder: true,
          slotType: true,
          player: {
            select: {
              id: true,
              name: true,
              role: true,
              source: true,
              teamName: true
            }
          }
        }
      }
    }
  });

  const blockedPlayerIds = new Set(
    await getBlockedPlayerIdsForLeague(team.leagueId)
  );

  const rosterValidation = validateRosterComposition(
    team.roster.map((entry) => ({
      isBlockedInLeague: blockedPlayerIds.has(entry.player.id),
      isGloballyInactive: !entry.player.isActive,
      role: entry.player.role
    }))
  );

  const starterPlayers =
    existingLineup?.players
      .filter((entry) => entry.slotType === "STARTER")
      .map((entry) => ({
        id: entry.player.id,
        role: entry.player.role
      })) ?? [];
  const benchPlayers =
    existingLineup?.players
      .filter((entry) => entry.slotType === "BENCH")
      .map((entry) => ({
        id: entry.player.id,
        role: entry.player.role
      })) ?? [];

  return {
    accessDenied: false as const,
    existingLineup,
    existingLineupValidation: existingLineup
      ? validateLineupComposition(starterPlayers, benchPlayers)
      : null,
    league: team.league,
    matchday,
    rosterPlayers: team.roster.map((entry) => ({
      id: entry.player.id,
      isActive: entry.player.isActive,
      isBlockedInLeague: blockedPlayerIds.has(entry.player.id),
      name: entry.player.name,
      role: entry.player.role,
      source: entry.player.source,
      teamName: entry.player.teamName
    })),
    rosterValidation,
    team
  };
}
