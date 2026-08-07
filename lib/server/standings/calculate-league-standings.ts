import { FantasyFixtureStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { AUTO_LINEUP_LEAGUE_POINTS_PENALTY } from "../../scoring/lineup-penalties.ts";
import { getFixtureForfeitOutcome } from "../fixtures/fixture-forfeit.ts";
import { prismaDecimalToNumber } from "../votes/shared.ts";

export type LeagueStandingRow = {
  bestFantasyScore: number;
  fantasyPointsTotal: number;
  goalDifference: number;
  goalsAgainst: number;
  goalsFor: number;
  leaguePoints: number;
  logoPath: string | null;
  logoUpdatedAt: Date | null;
  losses: number;
  played: number;
  teamId: string;
  teamName: string;
  wins: number;
  draws: number;
};

export type CalculateLeagueStandingsResult = {
  leagueId: string;
  standings: LeagueStandingRow[];
};

export type PublishedFixtureStandingInput = {
  awayGoals: number;
  /** Extra −N league points (AUTO_CARRIED or forfeit). May drive standings below 0. */
  awayLeaguePointsPenalty?: number;
  awayTeamScoreId: string | null;
  awayTotalScore: number;
  homeGoals: number;
  homeLeaguePointsPenalty?: number;
  homeTeamScoreId: string | null;
  homeTotalScore: number;
};

function createEmptyStanding(team: {
  id: string;
  logoPath: string | null;
  name: string;
  updatedAt: Date;
}): LeagueStandingRow {
  return {
    bestFantasyScore: 0,
    draws: 0,
    fantasyPointsTotal: 0,
    goalDifference: 0,
    goalsAgainst: 0,
    goalsFor: 0,
    leaguePoints: 0,
    logoPath: team.logoPath,
    logoUpdatedAt: team.logoPath ? team.updatedAt : null,
    losses: 0,
    played: 0,
    teamId: team.id,
    teamName: team.name,
    wins: 0
  };
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyPublishedFixtureToStandings(
  homeStanding: LeagueStandingRow,
  awayStanding: LeagueStandingRow,
  fixture: PublishedFixtureStandingInput
) {
  const forfeitOutcome = getFixtureForfeitOutcome({
    awayTeamScoreId: fixture.awayTeamScoreId,
    homeTeamScoreId: fixture.homeTeamScoreId
  });

  homeStanding.played += 1;
  awayStanding.played += 1;

  homeStanding.goalsFor += fixture.homeGoals;
  homeStanding.goalsAgainst += fixture.awayGoals;
  awayStanding.goalsFor += fixture.awayGoals;
  awayStanding.goalsAgainst += fixture.homeGoals;

  homeStanding.fantasyPointsTotal = roundToTwoDecimals(
    homeStanding.fantasyPointsTotal + fixture.homeTotalScore
  );
  awayStanding.fantasyPointsTotal = roundToTwoDecimals(
    awayStanding.fantasyPointsTotal + fixture.awayTotalScore
  );

  homeStanding.bestFantasyScore = Math.max(
    homeStanding.bestFantasyScore,
    fixture.homeTotalScore
  );
  awayStanding.bestFantasyScore = Math.max(
    awayStanding.bestFantasyScore,
    fixture.awayTotalScore
  );

  if (forfeitOutcome === "DOUBLE_FORFEIT") {
    homeStanding.losses += 1;
    awayStanding.losses += 1;
  } else if (fixture.homeGoals > fixture.awayGoals) {
    homeStanding.wins += 1;
    homeStanding.leaguePoints += 3;
    awayStanding.losses += 1;
  } else if (fixture.homeGoals < fixture.awayGoals) {
    awayStanding.wins += 1;
    awayStanding.leaguePoints += 3;
    homeStanding.losses += 1;
  } else {
    homeStanding.draws += 1;
    awayStanding.draws += 1;
    homeStanding.leaguePoints += 1;
    awayStanding.leaguePoints += 1;
  }

  homeStanding.leaguePoints -= fixture.homeLeaguePointsPenalty ?? 0;
  awayStanding.leaguePoints -= fixture.awayLeaguePointsPenalty ?? 0;
}

export async function calculateLeagueStandings(
  leagueId: string
): Promise<CalculateLeagueStandingsResult> {
  const [teams, publishedFixtures] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        logoPath: true,
        name: true,
        updatedAt: true
      }
    }),
    prisma.fantasyFixture.findMany({
      where: {
        matchday: {
          leagueId
        },
        status: FantasyFixtureStatus.PUBLISHED
      },
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
            leaguePointsPenalty: true,
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
            leaguePointsPenalty: true,
            totalScore: true
          }
        }
      }
    })
  ]);

  const standings = new Map<string, LeagueStandingRow>();
  for (const team of teams) {
    standings.set(team.id, createEmptyStanding(team));
  }

  for (const fixture of publishedFixtures) {
    if (fixture.homeGoals === null || fixture.awayGoals === null) {
      throw new Error(
        `Published fantasy fixture ${fixture.id} is missing calculated goals.`
      );
    }

    const homeStanding = standings.get(fixture.homeTeamId);
    const awayStanding = standings.get(fixture.awayTeamId);

    if (!homeStanding || !awayStanding) {
      throw new Error(
        `Fantasy fixture ${fixture.id} references a team outside league ${leagueId}.`
      );
    }

    applyPublishedFixtureToStandings(homeStanding, awayStanding, {
      awayGoals: fixture.awayGoals,
      awayLeaguePointsPenalty: fixture.awayTeamScore
        ? fixture.awayTeamScore.leaguePointsPenalty
        : AUTO_LINEUP_LEAGUE_POINTS_PENALTY,
      awayTeamScoreId: fixture.awayTeamScore?.id ?? null,
      awayTotalScore: prismaDecimalToNumber(fixture.awayTeamScore?.totalScore) ?? 0,
      homeGoals: fixture.homeGoals,
      homeLeaguePointsPenalty: fixture.homeTeamScore
        ? fixture.homeTeamScore.leaguePointsPenalty
        : AUTO_LINEUP_LEAGUE_POINTS_PENALTY,
      homeTeamScoreId: fixture.homeTeamScore?.id ?? null,
      homeTotalScore: prismaDecimalToNumber(fixture.homeTeamScore?.totalScore) ?? 0
    });
  }

  const rows = Array.from(standings.values()).map((standing) => ({
    ...standing,
    goalDifference: standing.goalsFor - standing.goalsAgainst
  }));

  rows.sort((left, right) => {
    if (right.leaguePoints !== left.leaguePoints) {
      return right.leaguePoints - left.leaguePoints;
    }

    if (right.goalDifference !== left.goalDifference) {
      return right.goalDifference - left.goalDifference;
    }

    if (right.goalsFor !== left.goalsFor) {
      return right.goalsFor - left.goalsFor;
    }

    if (right.fantasyPointsTotal !== left.fantasyPointsTotal) {
      return right.fantasyPointsTotal - left.fantasyPointsTotal;
    }

    return left.teamName.localeCompare(right.teamName, "it");
  });

  return {
    leagueId,
    standings: rows
  };
}
