import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.ts";
import { calculateFantasyFixtureResults } from "../lib/server/fixtures/calculate-fantasy-fixture-results.ts";
import {
  getFixtureForfeitOutcome,
  resolveFixtureSideScore,
  shouldShowFixtureForfeitNote
} from "../lib/server/fixtures/fixture-forfeit.ts";
import { generateFantasyFixtures } from "../lib/server/fixtures/generate-fantasy-fixtures.ts";
import { calculateLeagueStandings } from "../lib/server/standings/calculate-league-standings.ts";
import {
  applyPublishedFixtureToStandings,
  type LeagueStandingRow
} from "../lib/server/standings/calculate-league-standings.ts";
import {
  compareLeagueStandingRows,
  findStandingTieGroups,
  standingTieGroupNeedsAdmin
} from "../lib/server/standings/compare-league-standings.ts";
import { publishMatchday } from "../lib/server/matchdays/publish-matchday.ts";

const DEMO_LEAGUE_NAME = "Lega Fantacalcetto Demo";

function createEmptyStanding(teamId: string, teamName: string): LeagueStandingRow {
  return {
    bestFantasyScore: 0,
    draws: 0,
    fantasyPointsTotal: 0,
    goalDifference: 0,
    goalsAgainst: 0,
    goalsFor: 0,
    leaguePoints: 0,
    logoPath: null,
    logoUpdatedAt: null,
    losses: 0,
    needsAdminTieBreak: false,
    played: 0,
    standingsTieBreakRank: null,
    teamId,
    teamName,
    wins: 0
  };
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function runStandingTieBreakChecks() {
  const a = {
    fantasyPointsTotal: 100,
    goalDifference: 5,
    leaguePoints: 20,
    standingsTieBreakRank: null as number | null,
    teamId: "a",
    teamName: "Alpha"
  };
  const b = {
    fantasyPointsTotal: 110,
    goalDifference: 1,
    leaguePoints: 20,
    standingsTieBreakRank: null as number | null,
    teamId: "b",
    teamName: "Beta"
  };
  const c = {
    fantasyPointsTotal: 100,
    goalDifference: 5,
    leaguePoints: 20,
    standingsTieBreakRank: 2 as number | null,
    teamId: "c",
    teamName: "Charlie"
  };
  const d = {
    fantasyPointsTotal: 100,
    goalDifference: 5,
    leaguePoints: 20,
    standingsTieBreakRank: 1 as number | null,
    teamId: "d",
    teamName: "Delta"
  };

  assert(
    compareLeagueStandingRows(b, a) < 0,
    "Expected more fantapunti to rank above equal points."
  );
  assert(
    compareLeagueStandingRows(d, c) < 0,
    "Expected admin rank 1 above rank 2 on full auto tie."
  );

  const sorted = [a, b, c, d].sort(compareLeagueStandingRows);
  assert(sorted[0]?.teamId === "b", "Expected Beta first on fantapunti.");
  assert(
    sorted[1]?.teamId === "d" && sorted[2]?.teamId === "c",
    "Expected admin order Delta then Charlie."
  );

  const groups = findStandingTieGroups(
    [
      { ...b, goalDifference: 1 },
      { ...d, goalDifference: 5 },
      { ...c, goalDifference: 5 },
      { ...a, goalDifference: 5 }
    ].sort(compareLeagueStandingRows)
  );
  assert(groups.length === 1, "Expected one auto-criteria tie group of 3.");
  assert(groups[0]?.length === 3, "Expected Alpha/Charlie/Delta tied on auto.");
  assert(
    standingTieGroupNeedsAdmin([a, { ...a, teamName: "Zed" }]),
    "Expected unresolved group without ranks."
  );
  assert(
    !standingTieGroupNeedsAdmin([d, c]),
    "Expected resolved group with ranks 1 and 2."
  );
}

function runFixtureForfeitScenarioChecks() {
  const home = createEmptyStanding("home", "Home FC");
  const away = createEmptyStanding("away", "Away FC");

  applyPublishedFixtureToStandings(home, away, {
    awayGoals: 2,
    awayTeamScoreId: "away-score",
    awayTotalScore: 38.5,
    homeGoals: 3,
    homeTeamScoreId: "home-score",
    homeTotalScore: 41.5
  });

  assert(home.wins === 1, "Expected a normal home win with both scores present.");
  assert(away.losses === 1, "Expected away loss with both scores present.");

  const onlyHome = [createEmptyStanding("home", "Home FC"), createEmptyStanding("away", "Away FC")] as const;
  applyPublishedFixtureToStandings(onlyHome[0], onlyHome[1], {
    awayGoals: 0,
    awayLeaguePointsPenalty: 1,
    awayTeamScoreId: null,
    awayTotalScore: 0,
    homeGoals: 3,
    homeLeaguePointsPenalty: 0,
    homeTeamScoreId: "home-score",
    homeTotalScore: 36
  });
  assert(
    onlyHome[0].leaguePoints === 3 && onlyHome[0].wins === 1,
    "Expected home team to win 3 points by forfeit."
  );
  assert(
    onlyHome[1].losses === 1 && onlyHome[1].leaguePoints === -1,
    "Expected away team to lose by forfeit with −1 league points penalty."
  );

  const onlyAway = [createEmptyStanding("home", "Home FC"), createEmptyStanding("away", "Away FC")] as const;
  applyPublishedFixtureToStandings(onlyAway[0], onlyAway[1], {
    awayGoals: 3,
    awayLeaguePointsPenalty: 0,
    awayTeamScoreId: "away-score",
    awayTotalScore: 36,
    homeGoals: 0,
    homeLeaguePointsPenalty: 1,
    homeTeamScoreId: null,
    homeTotalScore: 0
  });
  assert(
    onlyAway[1].leaguePoints === 3 && onlyAway[1].wins === 1,
    "Expected away team to win 3 points by forfeit."
  );
  assert(
    onlyAway[0].losses === 1 && onlyAway[0].leaguePoints === -1,
    "Expected home team to lose by forfeit with −1 league points penalty."
  );

  const noScores = [createEmptyStanding("home", "Home FC"), createEmptyStanding("away", "Away FC")] as const;
  applyPublishedFixtureToStandings(noScores[0], noScores[1], {
    awayGoals: 0,
    awayLeaguePointsPenalty: 1,
    awayTeamScoreId: null,
    awayTotalScore: 0,
    homeGoals: 0,
    homeLeaguePointsPenalty: 1,
    homeTeamScoreId: null,
    homeTotalScore: 0
  });
  assert(
    noScores[0].leaguePoints === -1 && noScores[1].leaguePoints === -1,
    "Expected −1 league points each on double forfeit."
  );
  assert(
    noScores[0].losses === 1 && noScores[1].losses === 1,
    "Expected both teams to be marked as losers on double missing lineup."
  );

  const carriedWin = [
    createEmptyStanding("home", "Home FC"),
    createEmptyStanding("away", "Away FC")
  ] as const;
  applyPublishedFixtureToStandings(carriedWin[0], carriedWin[1], {
    awayGoals: 1,
    awayLeaguePointsPenalty: 0,
    awayTeamScoreId: "away-score",
    awayTotalScore: 30,
    homeGoals: 2,
    homeLeaguePointsPenalty: 1,
    homeTeamScoreId: "home-score",
    homeTotalScore: 33
  });
  assert(
    carriedWin[0].leaguePoints === 2 && carriedWin[0].wins === 1,
    "Expected AUTO_CARRIED winner to get 3−1 = 2 league points."
  );
  assert(
    carriedWin[1].leaguePoints === 0 && carriedWin[1].losses === 1,
    "Expected opponent loss with 0 league points."
  );

  assert(
    getFixtureForfeitOutcome({
      awayTeamScoreId: "away-score",
      homeTeamScoreId: "home-score"
    }) === "NONE",
    "Expected normal fixture outcome when both team scores exist."
  );
  assert(
    getFixtureForfeitOutcome({
      awayTeamScoreId: null,
      homeTeamScoreId: "home-score"
    }) === "HOME_WIN_BY_FORFEIT",
    "Expected home forfeit win when only home score exists."
  );
  assert(
    getFixtureForfeitOutcome({
      awayTeamScoreId: "away-score",
      homeTeamScoreId: null
    }) === "AWAY_WIN_BY_FORFEIT",
    "Expected away forfeit win when only away score exists."
  );
  assert(
    getFixtureForfeitOutcome({
      awayTeamScoreId: null,
      homeTeamScoreId: null
    }) === "DOUBLE_FORFEIT",
    "Expected double forfeit when neither team score exists."
  );

  const scoresByTeam = new Map([
    ["home", { id: "home-score", totalScore: 40 }],
    ["away", { id: "away-score", totalScore: 35 }]
  ]);
  assert(
    resolveFixtureSideScore({
      linkedScore: null,
      teamId: "home",
      teamScoresByTeamId: scoresByTeam
    })?.id === "home-score",
    "Expected resolveFixtureSideScore to fall back to matchday TeamScores."
  );
  assert(
    shouldShowFixtureForfeitNote({
      fixtureStatus: "SCHEDULED",
      matchdayHasTeamScores: false
    }) === false,
    "Expected no forfeit note on SCHEDULED fixtures before TeamScores exist."
  );
  assert(
    shouldShowFixtureForfeitNote({
      fixtureStatus: "SCHEDULED",
      matchdayHasTeamScores: true
    }) === true,
    "Expected forfeit notes once matchday TeamScores exist."
  );

  console.log("Fixture forfeit scenario checks passed.");
}

async function main() {
  runStandingTieBreakChecks();
  runFixtureForfeitScenarioChecks();
  try {
    const matchday = await prisma.matchday.findFirst({
      where: {
        league: {
          name: DEMO_LEAGUE_NAME
        },
        number: 1
      },
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!matchday) {
      throw new Error("Demo matchday not found. Run the seed first.");
    }

    const fixtures = await generateFantasyFixtures(matchday.id);
    console.log("Generated fixtures:", fixtures);

    const teamScoresCount = await prisma.teamScore.count({
      where: {
        matchdayId: matchday.id
      }
    });

    if (teamScoresCount === 0) {
      throw new Error(
        "No TeamScore found for the demo matchday. Run `npm run scores:check` first."
      );
    }

    const fixtureResults = await calculateFantasyFixtureResults(matchday.id);
    console.log("Calculated fixture results:", fixtureResults);

    const refreshedMatchday = await prisma.matchday.findUnique({
      where: {
        id: matchday.id
      },
      select: {
        status: true
      }
    });

    if (!refreshedMatchday) {
      throw new Error(`Matchday ${matchday.id} not found after fixture calculation.`);
    }

    if (
      refreshedMatchday.status === MatchdayStatus.SCORES_CALCULATED ||
      refreshedMatchday.status === MatchdayStatus.PUBLISHED
    ) {
      const published = await publishMatchday(matchday.id);
      console.log("Published matchday and fixtures:", published);
      console.log(`Fixtures published in this run: ${published.publishedFixturesCount}`);
    } else {
      console.log(
        `Matchday is in status ${refreshedMatchday.status}. Publication skipped.`
      );
    }

    const standings = await calculateLeagueStandings(matchday.league.id);
    console.log("League standings:");
    console.table(
      standings.standings.map((row) => ({
        bestFantasyScore: row.bestFantasyScore,
        draws: row.draws,
        fantasyPointsTotal: row.fantasyPointsTotal,
        goalDifference: row.goalDifference,
        goalsAgainst: row.goalsAgainst,
        goalsFor: row.goalsFor,
        leaguePoints: row.leaguePoints,
        losses: row.losses,
        played: row.played,
        team: row.teamName,
        wins: row.wins
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Database-backed fixture check skipped: ${message}`
    );
  }
}

main()
  .catch((error) => {
    console.error("Manual fixtures check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
