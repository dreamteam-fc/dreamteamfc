import {
  FantasyFixtureStatus,
  MatchdayStatus,
  ScoreStatus
} from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { calculateLeagueStandings } from "../standings/calculate-league-standings.ts";
import { prismaDecimalToNumber } from "../votes/shared.ts";
import { hasLeagueScheduleGenerated } from "../leagues/has-league-schedule-generated.ts";

const PUBLIC_MATCHDAY_STATUSES: MatchdayStatus[] = [
  MatchdayStatus.PUBLISHED,
  MatchdayStatus.LOCKED
];

const PUBLIC_TEAM_SCORE_STATUSES: ScoreStatus[] = [
  ScoreStatus.PUBLISHED,
  ScoreStatus.LOCKED
];

export async function getPublicLeagueLayoutData(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true
    }
  });
}

export async function getPublicLeaguesListData() {
  const leagues = await prisma.league.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      maxTeams: true,
      name: true,
      _count: {
        select: {
          fantasyTeams: true
        }
      }
    }
  });

  const leaguesWithScheduleState = await Promise.all(
    leagues.map(async (league) => ({
      league,
      scheduleGenerated: await hasLeagueScheduleGenerated(league.id)
    }))
  );

  return leaguesWithScheduleState.map(({ league, scheduleGenerated }) => {
    const fantasyTeamsCount = league._count.fantasyTeams;
    const availableSpots = Math.max(league.maxTeams - fantasyTeamsCount, 0);
    const registrationsClosed = scheduleGenerated;

    return {
      availableSpots,
      fantasyTeamsCount,
      id: league.id,
      maxTeams: league.maxTeams,
      name: league.name,
      registrationsClosed,
      statusLabel: registrationsClosed
        ? "Iscrizioni chiuse"
        : availableSpots > 0
          ? "Aperta"
          : "Piena"
    };
  });
}

export async function getPublicLeagueHomeData(leagueId: string) {
  const [league, standingsResult, scheduleGenerated] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        maxTeams: true,
        id: true,
        name: true,
        _count: {
          select: {
            fantasyTeams: true
          }
        },
        matchdays: {
          where: {
            status: {
              in: [...PUBLIC_MATCHDAY_STATUSES]
            }
          },
          orderBy: [{ number: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            number: true,
            status: true,
            _count: {
              select: {
                fixtures: true,
                teamScores: true
              }
            }
          }
        }
      }
    }),
    calculateLeagueStandings(leagueId),
    hasLeagueScheduleGenerated(leagueId)
  ]);

  if (!league) {
    return null;
  }

  return {
    league: {
      fantasyTeamsCount: league._count.fantasyTeams,
      id: league.id,
      isFull: league._count.fantasyTeams >= league.maxTeams,
      maxTeams: league.maxTeams,
      name: league.name,
      publishedMatchdaysCount: league.matchdays.length,
      registrationsClosed: scheduleGenerated
    },
    matchdays: league.matchdays,
    standings: standingsResult.standings
  };
}

export async function getPublicLeagueStandingsData(leagueId: string) {
  const [league, standingsResult] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
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
    }),
    calculateLeagueStandings(leagueId)
  ]);

  if (!league) {
    return null;
  }

  const publishedMatchdaysCount = await prisma.matchday.count({
    where: {
      leagueId,
      status: {
        in: [...PUBLIC_MATCHDAY_STATUSES]
      }
    }
  });

  return {
    league: {
      fantasyTeamsCount: league._count.fantasyTeams,
      id: league.id,
      name: league.name,
      publishedMatchdaysCount,
      totalMatchdaysCount: league._count.matchdays
    },
    standings: standingsResult.standings
  };
}

export async function getPublicLeagueScheduleData(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      maxTeams: true,
      name: true,
      fantasyTeams: {
        orderBy: [{ createdAt: "asc" }, { name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true
        }
      },
      matchdays: {
        orderBy: [{ number: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          number: true,
          status: true,
          fixtures: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              status: true,
              awayGoals: true,
              awayTeamScoreId: true,
              homeGoals: true,
              homeTeamScoreId: true,
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
              }
            }
          }
        }
      }
    }
  });

  if (!league) {
    return null;
  }

  const allTeams = league.fantasyTeams.map((team) => ({
    id: team.id,
    name: team.name
  }));

  return {
    league: {
      fantasyTeamsCount: league.fantasyTeams.length,
      id: league.id,
      maxTeams: league.maxTeams,
      name: league.name
    },
    matchdays: league.matchdays.map((matchday) => {
      const isPublic = PUBLIC_MATCHDAY_STATUSES.includes(matchday.status);
      const participatingTeamIds = new Set<string>();

      for (const fixture of matchday.fixtures) {
        participatingTeamIds.add(fixture.homeTeam.id);
        participatingTeamIds.add(fixture.awayTeam.id);
      }

      const restingTeams = allTeams.filter(
        (team) => !participatingTeamIds.has(team.id)
      );

      return {
        fixtures: matchday.fixtures.map((fixture) => ({
          awayGoals: isPublic ? fixture.awayGoals : null,
          awayTeam: fixture.awayTeam,
          homeGoals: isPublic ? fixture.homeGoals : null,
          homeTeam: fixture.homeTeam,
          id: fixture.id,
          showResult: isPublic,
          status: fixture.status,
          teamScoreState: isPublic
            ? {
                awayTeamScoreId: fixture.awayTeamScoreId,
                homeTeamScoreId: fixture.homeTeamScoreId
              }
            : null
        })),
        id: matchday.id,
        isPublic,
        number: matchday.number,
        restingTeams,
        status: matchday.status
      };
    })
  };
}

export async function getPublicMatchdayDetailData(
  leagueId: string,
  matchdayId: string
) {
  const matchday = await prisma.matchday.findFirst({
    where: {
      id: matchdayId,
      leagueId
    },
    include: {
      league: {
        select: {
          id: true,
          maxTeams: true,
          name: true,
          fantasyTeams: {
            orderBy: [{ createdAt: "asc" }, { name: "asc" }, { id: "asc" }],
            select: {
              id: true,
              name: true
            }
          }
        }
      },
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
      teamScores: {
        where: {
          status: {
            in: [...PUBLIC_TEAM_SCORE_STATUSES]
          }
        },
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
              },
              playerVote: {
                select: {
                  assists: true,
                  baseVote: true,
                  cleanSheet: true,
                  goals: true,
                  goalsConceded: true,
                  isSv: true,
                  ownGoals: true,
                  penaltiesMissed: true,
                  penaltiesSaved: true,
                  penaltiesScored: true,
                  redCards: true,
                  yellowCards: true
                }
              },
              replacedLineupPlayer: {
                select: {
                  id: true,
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
      }
    }
  });

  if (!matchday) {
    return null;
  }

  const isPublished = PUBLIC_MATCHDAY_STATUSES.includes(matchday.status);
  const participatingTeamIds = new Set<string>();

  for (const fixture of matchday.fixtures) {
    participatingTeamIds.add(fixture.homeTeam.id);
    participatingTeamIds.add(fixture.awayTeam.id);
  }

  const restingTeams = matchday.league.fantasyTeams.filter(
    (team) => !participatingTeamIds.has(team.id)
  );

  return {
    isPublished,
    matchday: {
      fixtures: matchday.fixtures.map((fixture) => ({
        awayGoals: isPublished ? fixture.awayGoals : null,
        awayTeam: fixture.awayTeam,
        awayTeamScore: isPublished && fixture.awayTeamScore
          ? {
              id: fixture.awayTeamScore.id,
              totalScore: prismaDecimalToNumber(
                fixture.awayTeamScore.totalScore
              )
            }
          : null,
        homeGoals: isPublished ? fixture.homeGoals : null,
        homeTeam: fixture.homeTeam,
        homeTeamScore: isPublished && fixture.homeTeamScore
          ? {
              id: fixture.homeTeamScore.id,
              totalScore: prismaDecimalToNumber(
                fixture.homeTeamScore.totalScore
              )
            }
          : null,
        id: fixture.id,
        showResult: isPublished,
        status: isPublished
          ? fixture.status
          : fixture.status === FantasyFixtureStatus.PUBLISHED ||
              fixture.status === FantasyFixtureStatus.LOCKED
            ? FantasyFixtureStatus.SCHEDULED
            : fixture.status
      })),
      id: matchday.id,
      league: {
        fantasyTeamsCount: matchday.league.fantasyTeams.length,
        id: matchday.league.id,
        maxTeams: matchday.league.maxTeams,
        name: matchday.league.name
      },
      number: matchday.number,
      restingTeams,
      status: matchday.status,
      teamScores: isPublished
        ? matchday.teamScores.map((teamScore) => ({
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
              replacedLineupPlayer: player.replacedLineupPlayer
                ? {
                    id: player.replacedLineupPlayer.id,
                    player: player.replacedLineupPlayer.player
                  }
                : null,
              slotType: player.slotType,
              vote: player.playerVote
                ? {
                    assists: player.playerVote.assists,
                    baseVote: prismaDecimalToNumber(player.playerVote.baseVote),
                    cleanSheet: player.playerVote.cleanSheet,
                    goals: player.playerVote.goals,
                    goalsConceded: player.playerVote.goalsConceded,
                    isSv: player.playerVote.isSv,
                    ownGoals: player.playerVote.ownGoals,
                    penaltiesMissed: player.playerVote.penaltiesMissed,
                    penaltiesSaved: player.playerVote.penaltiesSaved,
                    penaltiesScored: player.playerVote.penaltiesScored,
                    redCards: player.playerVote.redCards,
                    yellowCards: player.playerVote.yellowCards
                  }
                : player.isSv
                  ? { baseVote: null, isSv: true }
                  : null
            })),
            publishedAt: teamScore.publishedAt,
            status: teamScore.status,
            totalScore: prismaDecimalToNumber(teamScore.totalScore)
          }))
        : []
    }
  };
}

export async function getPublicMatchdayData(
  leagueId: string,
  matchdayId: string
) {
  return getPublicMatchdayDetailData(leagueId, matchdayId);
}
