import { prisma } from "../../prisma.ts";

export type ResetLeagueDataSummary = {
  fantasyFixtureCount: number;
  fantasyTeamCount: number;
  leagueCount: number;
  lineupCount: number;
  matchdayCount: number;
  rosterCount: number;
  scoreCount: number;
  voteCount: number;
};

/**
 * Wipe all league / fantasy-team domain data.
 *
 * Intentionally avoids a wrapping interactive `$transaction` over many
 * `deleteMany` calls. On Supabase PgBouncer, long Prisma interactive txs
 * drop mid-flight with "Transaction not found...".
 *
 * Deletes run as sequential plain queries in FK-safe order (children first).
 * Each `deleteMany` is its own short autocommit statement — durable under
 * PgBouncer the same way as calendar gen / score calc writes.
 */
export async function resetLeagueData(): Promise<ResetLeagueDataSummary> {
  const [
    leagueCount,
    fantasyTeamCount,
    matchdayCount,
    lineupCount,
    fantasyFixtureCount,
    rosterCount,
    voteCount,
    scoreCount
  ] = await Promise.all([
    prisma.league.count(),
    prisma.fantasyTeam.count(),
    prisma.matchday.count(),
    prisma.lineup.count(),
    prisma.fantasyFixture.count(),
    prisma.fantasyRoster.count(),
    prisma.playerVote.count(),
    prisma.teamScore.count()
  ]);

  // FK-safe order: dependents before parents (same order as before).
  await prisma.teamScorePlayer.deleteMany();
  await prisma.teamScore.deleteMany();
  await prisma.playerVote.deleteMany();
  await prisma.requiredVotePlayer.deleteMany();
  await prisma.lineupPlayer.deleteMany();
  await prisma.lineup.deleteMany();
  await prisma.fantasyFixture.deleteMany();
  await prisma.fantasyRoster.deleteMany();
  await prisma.fantasyTeam.deleteMany();
  await prisma.leagueMember.deleteMany();
  await prisma.matchday.deleteMany();
  await prisma.league.deleteMany();

  return {
    fantasyFixtureCount,
    fantasyTeamCount,
    leagueCount,
    lineupCount,
    matchdayCount,
    rosterCount,
    scoreCount,
    voteCount
  };
}
