import { RequiredVoteStatus, UserRole } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import type { PlayerRoleFilter } from "@/lib/players/player-role";
import { getNextUsefulMatchday } from "@/lib/matchdays/next-useful-matchday";
import {
  FULL_LEAGUE_TEAM_COUNT,
  getRosterPresenceStatus,
  isLeagueEligibleForLineupsHub,
  isRosterInserted
} from "@/lib/server/rosters/roster-presence";
import { REQUIRED_ROSTER_SIZE } from "@/lib/server/rosters/validate-roster-composition";
import { calculateLeagueStandings } from "../standings/calculate-league-standings.ts";
import { prismaDecimalToNumber } from "../votes/shared.ts";

export type AdminPlayerSourceFilter =
  | "ALL"
  | "api-football"
  | "demo"
  | "fantacalcio-quotazioni"
  | "unknown";

export type AdminPlayerStatusFilter = "ACTIVE" | "ALL" | "INACTIVE";
export type AdminVoteStatusFilter =
  | "ALL"
  | "COMPLETED"
  | "IGNORED"
  | "PENDING"
  | "SV";

const REQUIRED_VOTE_STATUS_ORDER: Record<RequiredVoteStatus, number> = {
  PENDING: 0,
  SV: 1,
  COMPLETED: 2,
  IGNORED: 3
};

export async function getAdminDashboardData() {
  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: {
      fantasyTeams: {
        select: {
          id: true,
          _count: {
            select: {
              roster: true
            }
          }
        }
      },
      matchdays: {
        orderBy: {
          number: "asc"
        },
        include: {
          _count: {
            select: {
              lineups: true,
              playerVotes: true,
              requiredVotes: true,
              teamScores: true
            }
          }
        }
      },
      _count: {
        select: {
          fantasyTeams: true,
          members: true
        }
      }
    }
  });

  return {
    leagues: leagues.map((league) => {
      const teamsWithRoster = league.fantasyTeams.filter((team) =>
        isRosterInserted(team._count.roster)
      ).length;
      const teamCount = league._count.fantasyTeams;

      return {
        ...league,
        availableSpots: Math.max(league.maxTeams - teamCount, 0),
        teamsWithCompleteRoster: teamsWithRoster,
        /** @deprecated Prefer teamsWithCompleteRoster — complete (25) rose. */
        teamsWithRoster,
        isLineupsHubEligible: isLeagueEligibleForLineupsHub({
          teamCount,
          teamsWithCompleteRoster: teamsWithRoster
        })
      };
    })
  };
}

/**
 * Admin hub: leagues with exactly 10 teams and all complete rose,
 * plus the next useful matchday for formation workflow.
 */
export async function getAdminLineupsHubData() {
  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      maxTeams: true,
      fantasyTeams: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          user: {
            select: {
              displayName: true,
              email: true
            }
          },
          _count: {
            select: {
              roster: true
            }
          }
        }
      },
      matchdays: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          status: true,
          _count: {
            select: {
              lineups: true
            }
          }
        }
      },
      _count: {
        select: {
          fantasyTeams: true
        }
      }
    }
  });

  const eligibleLeagues = leagues
    .map((league) => {
      const teamsWithCompleteRoster = league.fantasyTeams.filter((team) =>
        isRosterInserted(team._count.roster)
      ).length;
      const teamCount = league._count.fantasyTeams;
      const eligible = isLeagueEligibleForLineupsHub({
        teamCount,
        teamsWithCompleteRoster
      });

      if (!eligible) {
        return null;
      }

      const nextMatchday = getNextUsefulMatchday(league.matchdays);

      return {
        id: league.id,
        name: league.name,
        status: league.status,
        maxTeams: league.maxTeams,
        teamCount,
        teamsWithCompleteRoster,
        requiredRosterSize: REQUIRED_ROSTER_SIZE,
        requiredTeamCount: FULL_LEAGUE_TEAM_COUNT,
        nextMatchday: nextMatchday
          ? {
              id: nextMatchday.id,
              number: nextMatchday.number,
              status: nextMatchday.status,
              lineupsCount: nextMatchday._count.lineups
            }
          : null,
        teams: league.fantasyTeams.map((team) => {
          const rosterCount = team._count.roster;
          return {
            id: team.id,
            name: team.name,
            ownerDisplayName: team.user.displayName,
            ownerEmail: team.user.email,
            rosterCount,
            rosterStatus: getRosterPresenceStatus(rosterCount)
          };
        })
      };
    })
    .filter((league): league is NonNullable<typeof league> => league != null);

  return {
    eligibleLeagues,
    requiredRosterSize: REQUIRED_ROSTER_SIZE,
    requiredTeamCount: FULL_LEAGUE_TEAM_COUNT
  };
}

/** Registered app users for platform role assignment (Admin only UI). */
export async function getAdminPlatformUsersData() {
  const roleRank: Record<UserRole, number> = {
    [UserRole.ADMIN]: 0,
    [UserRole.MISTER]: 1,
    [UserRole.USER]: 2
  };

  const users = await prisma.user.findMany({
    orderBy: [{ email: "asc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
      authUserId: true
    }
  });

  users.sort((a, b) => {
    const rankDiff = roleRank[a.role] - roleRank[b.role];
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.email.localeCompare(b.email);
  });

  return { users };
}

export async function getAdminMatchdayVotesData(
  matchdayId: string,
  options?: {
    roleFilter?: PlayerRoleFilter;
    searchQuery?: string;
    statusFilter?: AdminVoteStatusFilter;
  }
) {
  const roleFilter = options?.roleFilter ?? "ALL";
  const statusFilter = options?.statusFilter ?? "ALL";
  const normalizedSearchQuery = options?.searchQuery?.trim() ?? "";
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    include: {
      league: {
        select: {
          id: true,
          maxAutoSubs: true,
          name: true,
          startersCount: true
        }
      },
      lineups: {
        select: {
          id: true
        }
      },
      requiredVotes: {
        include: {
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
      },
      playerVotes: {
        select: {
          assists: true,
          baseVote: true,
          cleanSheet: true,
          finalFantavote: true,
          goals: true,
          goalsConceded: true,
          id: true,
          isSv: true,
          matchdayId: true,
          notes: true,
          ownGoals: true,
          penaltiesMissed: true,
          penaltiesSaved: true,
          penaltiesScored: true,
          playerId: true,
          redCards: true,
          status: true,
          yellowCards: true
        }
      }
    }
  });

  if (!matchday) {
    return null;
  }

  const votesByPlayerId = new Map(
    matchday.playerVotes.map((vote) => [vote.playerId, vote])
  );
  const blockedPlayers = await prisma.leagueBlockedPlayer.findMany({
    where: {
      leagueId: matchday.league.id,
      playerId: {
        in: matchday.requiredVotes.map((record) => record.playerId)
      }
    },
    select: {
      playerId: true
    }
  });
  const blockedPlayerIds = new Set(blockedPlayers.map((entry) => entry.playerId));
  const pendingCount = matchday.requiredVotes.filter(
    (record) => record.status === "PENDING"
  ).length;
  const completedStatusCount = matchday.requiredVotes.filter(
    (record) => record.status === "COMPLETED"
  ).length;
  const svCount = matchday.requiredVotes.filter(
    (record) => record.status === "SV"
  ).length;
  const ignoredCount = matchday.requiredVotes.filter(
    (record) => record.status === "IGNORED"
  ).length;
  const completedCount = matchday.requiredVotes.filter(
    (record) => record.status !== "PENDING"
  ).length;
  const missingCount = matchday.requiredVotes.length - completedCount;
  const allRequiredVotePlayers = matchday.requiredVotes
    .map((requiredVotePlayer) => {
      const playerVote = votesByPlayerId.get(requiredVotePlayer.playerId);

      return {
        player: {
          ...requiredVotePlayer.player,
          isBlockedInLeague: blockedPlayerIds.has(requiredVotePlayer.player.id),
          isUnavailable:
            blockedPlayerIds.has(requiredVotePlayer.player.id) ||
            !requiredVotePlayer.player.isActive
        },
        playerVote: playerVote
          ? {
              ...playerVote,
              baseVote: prismaDecimalToNumber(playerVote.baseVote),
              finalFantavote: prismaDecimalToNumber(playerVote.finalFantavote)
            }
          : null,
        status: requiredVotePlayer.status,
        usageCount: requiredVotePlayer.usageCount
      };
    })
    .sort((left, right) => {
      const statusDiff =
        REQUIRED_VOTE_STATUS_ORDER[left.status] -
        REQUIRED_VOTE_STATUS_ORDER[right.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return left.player.name.localeCompare(right.player.name, "it");
    });

  const filteredRequiredVotePlayers = allRequiredVotePlayers.filter((record) => {
    const matchesSearch =
      normalizedSearchQuery.length === 0 ||
      record.player.name.toLocaleLowerCase("it").includes(
        normalizedSearchQuery.toLocaleLowerCase("it")
      );
    const matchesRole =
      roleFilter === "ALL" || record.player.role === roleFilter;
    const matchesStatus =
      statusFilter === "ALL" || record.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return {
    completion: {
      completedStatusCount,
      completedCount,
      ignoredCount,
      isComplete:
        matchday.requiredVotes.length > 0 && missingCount === 0,
      missingCount,
      pendingCount,
      svCount,
      totalRequired: matchday.requiredVotes.length
    },
    matchday: {
      id: matchday.id,
      league: matchday.league,
      lineupDeadlineAt: matchday.lineupDeadlineAt,
      lineupsCount: matchday.lineups.length,
      number: matchday.number,
      requiredVotePlayers: filteredRequiredVotePlayers,
      status: matchday.status
    },
    filters: {
      roleFilter,
      searchQuery: normalizedSearchQuery,
      statusFilter
    },
    totals: {
      filteredCount: filteredRequiredVotePlayers.length,
      totalCount: allRequiredVotePlayers.length
    }
  };
}

export async function getAdminMatchdayScoresData(matchdayId: string) {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    include: {
      fixtures: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          awayTeam: {
            select: {
              id: true,
              name: true
            }
          },
          awayTeamScore: {
            select: {
              id: true,
              totalScore: true
            }
          },
          homeTeam: {
            select: {
              id: true,
              name: true
            }
          },
          homeTeamScore: {
            select: {
              id: true,
              totalScore: true
            }
          }
        }
      },
      league: {
        select: {
          id: true,
          maxAutoSubs: true,
          name: true,
          startersCount: true
        }
      },
      requiredVotes: {
        orderBy: [{ usageCount: "desc" }, { player: { name: "asc" } }],
        include: {
          player: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      teamScores: {
        orderBy: [{ totalScore: "desc" }, { fantasyTeam: { name: "asc" } }],
        include: {
          fantasyTeam: {
            select: {
              id: true,
              name: true
            }
          },
          players: {
            orderBy: [{ countsForScore: "desc" }, { positionOrder: "asc" }],
            include: {
              player: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!matchday) {
    return null;
  }

  const completedCount = matchday.requiredVotes.filter(
    (record) => record.status !== "PENDING"
  ).length;
  const missingRecords = matchday.requiredVotes
    .filter((record) => record.status === "PENDING")
    .map((record) => ({
      playerId: record.player.id,
      playerName: record.player.name,
      status: record.status,
      usageCount: record.usageCount
    }));

  return {
    completion: {
      completedCount,
      isComplete:
        matchday.requiredVotes.length > 0 && missingRecords.length === 0,
      missingCount: missingRecords.length,
      missingRecords,
      totalRequired: matchday.requiredVotes.length
    },
    matchday: {
      id: matchday.id,
      fixtures: matchday.fixtures.map((fixture) => ({
        awayGoals: fixture.awayGoals,
        awayTeam: fixture.awayTeam,
        awayTeamScore: fixture.awayTeamScore
          ? {
              id: fixture.awayTeamScore.id,
              totalScore: prismaDecimalToNumber(fixture.awayTeamScore.totalScore)
            }
          : null,
        homeGoals: fixture.homeGoals,
        homeTeam: fixture.homeTeam,
        homeTeamScore: fixture.homeTeamScore
          ? {
              id: fixture.homeTeamScore.id,
              totalScore: prismaDecimalToNumber(fixture.homeTeamScore.totalScore)
            }
          : null,
        id: fixture.id,
        status: fixture.status
      })),
      league: matchday.league,
      number: matchday.number,
      status: matchday.status,
      teamScores: matchday.teamScores.map((teamScore) => ({
        autoSubsUsed: teamScore.autoSubsUsed,
        fantasyTeam: teamScore.fantasyTeam,
        id: teamScore.id,
        players: teamScore.players.map((player) => ({
          countsForScore: player.countsForScore,
          finalFantavote: prismaDecimalToNumber(player.finalFantavote),
          finalType: player.finalType,
          id: player.id,
          isSv: player.isSv,
          player: player.player,
          positionOrder: player.positionOrder,
          slotType: player.slotType
        })),
        publishedAt: teamScore.publishedAt,
        status: teamScore.status,
        totalScore: prismaDecimalToNumber(teamScore.totalScore)
      }))
    }
  };
}

export async function getAdminLeagueStandingsData(leagueId: string) {
  const [league, standingsResult] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        status: true,
        _count: {
          select: {
            fantasyTeams: true,
            matchdays: true
          }
        }
      }
    }),
    calculateLeagueStandings(leagueId)
  ]);

  if (!league) {
    return null;
  }

  return {
    league,
    standings: standingsResult.standings
  };
}

export async function getAdminLeagueMatchdayCreationData(leagueId: string) {
  return prisma.league.findUnique({
    where: {
      id: leagueId
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          fantasyTeams: true,
          matchdays: true
        }
      }
    }
  });
}

export async function getAdminLeagueScheduleData(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: {
      id: leagueId
    },
    select: {
      id: true,
      maxTeams: true,
      name: true,
      fantasyTeams: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true
        }
      },
      matchdays: {
        orderBy: [{ number: "asc" }],
        select: {
          fixtures: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
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
              id: true
            }
          },
          id: true,
          number: true,
          status: true,
          _count: {
            select: {
              fixtures: true
            }
          }
        }
      },
      _count: {
        select: {
          fantasyTeams: true,
          matchdays: true
        }
      }
    }
  });

  if (!league) {
    return null;
  }

  const fixtureCount = await prisma.fantasyFixture.count({
    where: {
      matchday: {
        leagueId
      }
    }
  });

  const teamCount = league._count.fantasyTeams;
  const singleRoundMatchdayCount =
    teamCount >= 2 ? (teamCount % 2 === 0 ? teamCount - 1 : teamCount) : 0;
  const singleRoundFixtureCount =
    teamCount >= 2 ? (teamCount * (teamCount - 1)) / 2 : 0;

  return {
    existingFixtureCount: fixtureCount,
    hasExistingSchedule: league._count.matchdays > 0 || fixtureCount > 0,
    league,
    previews: {
      doubleRoundFixtureCount: singleRoundFixtureCount * 2,
      doubleRoundMatchdayCount: singleRoundMatchdayCount * 2,
      hasBye: teamCount % 2 === 1,
      singleRoundFixtureCount,
      singleRoundMatchdayCount,
      teamCount
    }
  };
}

export async function getAdminLeaguePlayersData(
  leagueId: string,
  roleFilter: PlayerRoleFilter,
  searchQuery?: string
) {
  const normalizedSearchQuery = searchQuery?.trim() ?? "";
  const league = await prisma.league.findUnique({
    where: {
      id: leagueId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!league) {
    return null;
  }

  const [activePlayers, blockedPlayers] = await Promise.all([
    prisma.player.findMany({
      where: {
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
    }),
    prisma.leagueBlockedPlayer.findMany({
      where: {
        leagueId
      },
      select: {
        playerId: true,
        reason: true
      }
    })
  ]);

  const blockedPlayersMap = new Map(
    blockedPlayers.map((entry) => [entry.playerId, entry.reason ?? null])
  );

  return {
    league,
    players: activePlayers.map((player) => ({
      ...player,
      blockReason: blockedPlayersMap.get(player.id) ?? null,
      isBlockedInLeague: blockedPlayersMap.has(player.id)
    })),
    roleFilter,
    searchQuery: normalizedSearchQuery
  };
}

export async function getAdminPlayersData(options: {
  limit?: number;
  roleFilter: PlayerRoleFilter;
  searchQuery?: string;
  sourceFilter: AdminPlayerSourceFilter;
  statusFilter: AdminPlayerStatusFilter;
}) {
  const normalizedSearchQuery = options.searchQuery?.trim() ?? "";
  const limit = options.limit ?? 100;

  const where = {
    ...(normalizedSearchQuery.length > 0
      ? {
          name: {
            contains: normalizedSearchQuery,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(options.roleFilter === "ALL" ? {} : { role: options.roleFilter }),
    ...(options.statusFilter === "ALL"
      ? {}
      : { isActive: options.statusFilter === "ACTIVE" }),
    ...(options.sourceFilter === "ALL"
      ? {}
      : options.sourceFilter === "unknown"
        ? {
            OR: [{ source: null }, { source: "" }]
          }
        : {
            source: options.sourceFilter
          })
  };

  const [players, filteredCount, totalPlayers, activePlayersCount, inactivePlayersCount] =
    await Promise.all([
      prisma.player.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: limit,
        select: {
          externalId: true,
          id: true,
          isActive: true,
          name: true,
          role: true,
          source: true
        }
      }),
      prisma.player.count({ where }),
      prisma.player.count(),
      prisma.player.count({
        where: {
          isActive: true
        }
      }),
      prisma.player.count({
        where: {
          isActive: false
        }
      })
    ]);

  return {
    counts: {
      active: activePlayersCount,
      filtered: filteredCount,
      inactive: inactivePlayersCount,
      total: totalPlayers
    },
    filters: {
      roleFilter: options.roleFilter,
      searchQuery: normalizedSearchQuery,
      sourceFilter: options.sourceFilter,
      statusFilter: options.statusFilter
    },
    hasMore: filteredCount > players.length,
    limit,
    players
  };
}

export async function getAdminMatchdayDetailData(matchdayId: string) {
  const matchday = await prisma.matchday.findUnique({
    where: {
      id: matchdayId
    },
    select: {
      id: true,
      fixtures: {
        select: {
          id: true,
          status: true
        }
      },
      league: {
        select: {
          id: true,
          name: true,
          fantasyTeams: {
            orderBy: {
              name: "asc"
            },
            select: {
              id: true,
              name: true,
              user: {
                select: {
                  displayName: true,
                  email: true
                }
              },
              lineups: {
                where: {
                  matchdayId
                },
                select: {
                  id: true,
                  source: true,
                  status: true,
                  submittedAt: true,
                  _count: {
                    select: {
                      players: true
                    }
                  }
                },
                take: 1
              }
            }
          },
          _count: {
            select: {
              fantasyTeams: true
            }
          }
        }
      },
      lineupDeadlineAt: true,
      number: true,
      requiredVotes: {
        select: {
          id: true,
          status: true
        }
      },
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

  if (!matchday) {
    return null;
  }

  const completedVotesCount = matchday.requiredVotes.filter(
    (requiredVote) => requiredVote.status !== "PENDING"
  ).length;
  const missingVotesCount = matchday.requiredVotes.length - completedVotesCount;
  const hasCalculatedFixtures = matchday.fixtures.some(
    (fixture) => fixture.status === "CALCULATED"
  );
  const hasPublishedFixtures = matchday.fixtures.some(
    (fixture) => fixture.status === "PUBLISHED"
  );
  const hasScheduledFixtures = matchday.fixtures.some(
    (fixture) => fixture.status === "SCHEDULED"
  );

  const teamLineupStatuses = matchday.league.fantasyTeams.map((team) => {
    const lineup = team.lineups[0] ?? null;

    let formationStatus:
      | "INSERITA"
      | "MISTER"
      | "RECUPERATA"
      | "ADMIN"
      | "NON_INSERITA" = "NON_INSERITA";
    if (lineup) {
      if (lineup.source === "AUTO_CARRIED") {
        formationStatus = "RECUPERATA";
      } else if (lineup.source === "ADMIN_RANDOM") {
        formationStatus = "ADMIN";
      } else if (lineup.source === "COACH") {
        formationStatus = "MISTER";
      } else {
        formationStatus = "INSERITA";
      }
    }

    return {
      fantasyTeamId: team.id,
      fantasyTeamName: team.name,
      ownerDisplayName: team.user.displayName,
      ownerEmail: team.user.email,
      lineupId: lineup?.id ?? null,
      lineupPlayerCount: lineup?._count.players ?? 0,
      lineupSource: lineup?.source ?? null,
      lineupStatus: lineup?.status ?? null,
      submittedAt: lineup?.submittedAt ?? null,
      formationStatus
    };
  });

  const insertedLineupsCount = teamLineupStatuses.filter(
    (team) => team.formationStatus !== "NON_INSERITA"
  ).length;
  const autoCarriedLineupsCount = teamLineupStatuses.filter(
    (team) => team.formationStatus === "RECUPERATA"
  ).length;
  const missingLineupsCount = teamLineupStatuses.length - insertedLineupsCount;

  const { fantasyTeams: _fantasyTeams, ...leagueWithoutTeams } = matchday.league;

  return {
    ...matchday,
    league: leagueWithoutTeams,
    completedVotesCount,
    hasCalculatedFixtures,
    hasPublishedFixtures,
    hasScheduledFixtures,
    autoCarriedLineupsCount,
    insertedLineupsCount,
    missingLineupsCount,
    missingVotesCount,
    teamLineupStatuses
  };
}

const UNIFIED_VOTES_MATCHDAY_STATUSES = [
  "LINEUPS_LOCKED",
  "VOTES_PENDING",
  "VOTES_COMPLETED",
  "SCORES_CALCULATED"
] as const;

type UnifiedVoteSnapshot = {
  assists: number;
  baseVote: number | null;
  cleanSheet: number;
  finalFantavote: number | null;
  goals: number;
  goalsConceded: number;
  isSv: boolean;
  leagueName: string;
  matchdayId: string;
  notes: string | null;
  ownGoals: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesScored: number;
  redCards: number;
  status: string;
  yellowCards: number;
};

export async function getAdminUnifiedVotesData(options?: {
  matchdayNumber?: number;
  searchQuery?: string;
}) {
  const matchdayNumber = options?.matchdayNumber;
  const normalizedSearchQuery = options?.searchQuery?.trim() ?? "";

  const numberRows = await prisma.matchday.findMany({
    where: {
      status: { in: [...UNIFIED_VOTES_MATCHDAY_STATUSES] }
    },
    distinct: ["number"],
    orderBy: { number: "asc" },
    select: { number: true }
  });
  const availableNumbers = numberRows.map((row) => row.number);

  const selectedNumber =
    typeof matchdayNumber === "number" && Number.isFinite(matchdayNumber)
      ? matchdayNumber
      : (availableNumbers[0] ?? null);

  if (selectedNumber == null) {
    return {
      availableNumbers,
      matchdays: [],
      players: [],
      searchQuery: normalizedSearchQuery,
      selectedNumber: null,
      totals: {
        leagueCount: 0,
        pendingPlayers: 0,
        playerCount: 0
      }
    };
  }

  const selectedMatchdays = await prisma.matchday.findMany({
    where: {
      number: selectedNumber,
      status: { in: [...UNIFIED_VOTES_MATCHDAY_STATUSES] }
    },
    orderBy: [{ league: { name: "asc" } }],
    select: {
      id: true,
      number: true,
      status: true,
      league: {
        select: {
          id: true,
          name: true
        }
      },
      lineups: {
        select: {
          players: {
            where: { slotType: "STARTER" },
            select: {
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
      },
      teamScores: {
        select: {
          players: {
            where: {
              finalType: { in: ["STARTER_PLAYED", "AUTO_SUB_IN"] }
            },
            select: {
              playerId: true,
              finalType: true,
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
      },
      requiredVotes: {
        select: {
          playerId: true,
          status: true,
          usageCount: true
        }
      },
      playerVotes: {
        select: {
          assists: true,
          baseVote: true,
          cleanSheet: true,
          finalFantavote: true,
          goals: true,
          goalsConceded: true,
          isSv: true,
          notes: true,
          ownGoals: true,
          penaltiesMissed: true,
          penaltiesSaved: true,
          penaltiesScored: true,
          playerId: true,
          redCards: true,
          status: true,
          yellowCards: true
        }
      }
    }
  });

  const playersById = new Map<
    string,
    {
      appearances: Array<{
        leagueId: string;
        leagueName: string;
        matchdayId: string;
        requiredStatus: string | null;
        source: "AUTO_SUB_IN" | "STARTER" | "STARTER_PLAYED";
      }>;
      player: {
        id: string;
        isActive: boolean;
        name: string;
        role: "ATTACKER" | "DEFENDER" | "GOALKEEPER" | "MIDFIELDER";
        teamName: string | null;
      };
      votes: UnifiedVoteSnapshot[];
    }
  >();

  function toVoteSnapshot(
    matchday: (typeof selectedMatchdays)[number],
    vote: (typeof selectedMatchdays)[number]["playerVotes"][number]
  ): UnifiedVoteSnapshot {
    return {
      assists: vote.assists,
      baseVote: prismaDecimalToNumber(vote.baseVote),
      cleanSheet: vote.cleanSheet,
      finalFantavote: prismaDecimalToNumber(vote.finalFantavote),
      goals: vote.goals,
      goalsConceded: vote.goalsConceded,
      isSv: vote.isSv,
      leagueName: matchday.league.name,
      matchdayId: matchday.id,
      notes: vote.notes,
      ownGoals: vote.ownGoals,
      penaltiesMissed: vote.penaltiesMissed,
      penaltiesSaved: vote.penaltiesSaved,
      penaltiesScored: vote.penaltiesScored,
      redCards: vote.redCards,
      status: vote.status,
      yellowCards: vote.yellowCards
    };
  }

  function upsertPlayerAppearance(options: {
    matchday: (typeof selectedMatchdays)[number];
    player: {
      id: string;
      isActive: boolean;
      name: string;
      role: "ATTACKER" | "DEFENDER" | "GOALKEEPER" | "MIDFIELDER";
      teamName: string | null;
    };
    requiredStatus: string | null;
    source: "AUTO_SUB_IN" | "STARTER" | "STARTER_PLAYED";
    vote: (typeof selectedMatchdays)[number]["playerVotes"][number] | undefined;
  }) {
    const appearance = {
      leagueId: options.matchday.league.id,
      leagueName: options.matchday.league.name,
      matchdayId: options.matchday.id,
      requiredStatus: options.requiredStatus,
      source: options.source
    };
    const existing = playersById.get(options.player.id);
    const voteEntry = options.vote
      ? toVoteSnapshot(options.matchday, options.vote)
      : null;

    if (existing) {
      existing.appearances.push(appearance);
      if (voteEntry) {
        existing.votes.push(voteEntry);
      }
      return;
    }

    playersById.set(options.player.id, {
      appearances: [appearance],
      player: options.player,
      votes: voteEntry ? [voteEntry] : []
    });
  }

  for (const matchday of selectedMatchdays) {
    const requiredByPlayerId = new Map(
      matchday.requiredVotes.map((entry) => [entry.playerId, entry])
    );
    const voteByPlayerId = new Map(
      matchday.playerVotes.map((entry) => [entry.playerId, entry])
    );
    const hasScores = matchday.teamScores.length > 0;

    if (hasScores) {
      for (const teamScore of matchday.teamScores) {
        for (const scorePlayer of teamScore.players) {
          upsertPlayerAppearance({
            matchday,
            player: scorePlayer.player,
            requiredStatus:
              requiredByPlayerId.get(scorePlayer.playerId)?.status ?? null,
            source:
              scorePlayer.finalType === "AUTO_SUB_IN"
                ? "AUTO_SUB_IN"
                : "STARTER_PLAYED",
            vote: voteByPlayerId.get(scorePlayer.playerId)
          });
        }
      }
      continue;
    }

    for (const lineup of matchday.lineups) {
      for (const lineupPlayer of lineup.players) {
        upsertPlayerAppearance({
          matchday,
          player: lineupPlayer.player,
          requiredStatus:
            requiredByPlayerId.get(lineupPlayer.playerId)?.status ?? null,
          source: "STARTER",
          vote: voteByPlayerId.get(lineupPlayer.playerId)
        });
      }
    }
  }

  let players = Array.from(playersById.values()).map((entry) => {
    const pendingAppearances = entry.appearances.filter(
      (appearance) => appearance.requiredStatus === "PENDING"
    ).length;
    const leagueNames = Array.from(
      new Set(entry.appearances.map((appearance) => appearance.leagueName))
    ).sort((left, right) => left.localeCompare(right));
    const matchdayIds = Array.from(
      new Set(entry.appearances.map((appearance) => appearance.matchdayId))
    );
    const formVote =
      entry.votes.find((vote) => vote.isSv || vote.baseVote != null) ??
      entry.votes[0] ??
      null;

    return {
      ...entry,
      formVote,
      leagueCount: leagueNames.length,
      leagueNames,
      matchdayIds,
      pendingAppearances
    };
  });

  if (normalizedSearchQuery.length > 0) {
    const query = normalizedSearchQuery.toLowerCase();
    players = players.filter((entry) =>
      entry.player.name.toLowerCase().includes(query)
    );
  }

  players.sort((left, right) => {
    if (right.pendingAppearances !== left.pendingAppearances) {
      return right.pendingAppearances - left.pendingAppearances;
    }
    return left.player.name.localeCompare(right.player.name, "it");
  });

  return {
    availableNumbers,
    matchdays: selectedMatchdays.map((matchday) => ({
      id: matchday.id,
      leagueId: matchday.league.id,
      leagueName: matchday.league.name,
      number: matchday.number,
      status: matchday.status,
      hasScores: matchday.teamScores.length > 0
    })),
    players,
    searchQuery: normalizedSearchQuery,
    selectedNumber,
    totals: {
      leagueCount: selectedMatchdays.length,
      pendingPlayers: players.filter((entry) => entry.pendingAppearances > 0)
        .length,
      playerCount: players.length
    }
  };
}

export async function getAdminLeagueTeamsData(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      maxTeams: true,
      fantasyTeams: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          user: {
            select: {
              displayName: true,
              email: true
            }
          },
          _count: {
            select: {
              roster: true
            }
          }
        }
      }
    }
  });

  if (!league) {
    return null;
  }

  const teams = league.fantasyTeams.map((team) => {
    const rosterCount = team._count.roster;
    return {
      ...team,
      rosterCount,
      rosterStatus: getRosterPresenceStatus(rosterCount)
    };
  });
  const teamsWithCompleteRoster = teams.filter(
    (team) => team.rosterStatus === "COMPLETA"
  ).length;

  return {
    league: {
      ...league,
      fantasyTeams: teams
    },
    requiredRosterSize: REQUIRED_ROSTER_SIZE,
    teamsWithCompleteRoster
  };
}
