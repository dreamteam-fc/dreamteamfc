import {
  TournamentFixtureStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "../../prisma.ts";

export type ResetTournamentRoundResultsSummary = {
  clearedNextRoundTeamSlots: number;
  deletedPlayerVotes: number;
  deletedRequiredVotes: number;
  resetFixtureResults: number;
  roundId: string;
  roundIndex: number;
  roundName: string;
  subsequentRoundsCleared: number;
  tournamentId: string;
  tournamentName: string;
  tournamentStatusAfter: TournamentStatus;
  tournamentStatusBefore: TournamentStatus;
};

type ResolveOptions = {
  /** Explicit round id; defaults to lowest roundIndex with fixtures. */
  roundId?: string;
  /** Explicit tournament id; defaults to most recent non-COMPLETED. */
  tournamentId?: string;
};

async function resolveTarget(options: ResolveOptions) {
  let tournament =
    options.tournamentId != null
      ? await prisma.tournament.findUnique({
          where: { id: options.tournamentId },
          select: {
            id: true,
            name: true,
            status: true,
            rounds: {
              orderBy: { roundIndex: "asc" },
              select: {
                id: true,
                name: true,
                roundIndex: true,
                _count: { select: { fixtures: true } }
              }
            }
          }
        })
      : null;

  if (!tournament) {
    const candidates = await prisma.tournament.findMany({
      where: {
        status: {
          in: [
            TournamentStatus.BRACKET_GENERATED,
            TournamentStatus.IN_PROGRESS
          ]
        }
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        rounds: {
          orderBy: { roundIndex: "asc" },
          select: {
            id: true,
            name: true,
            roundIndex: true,
            _count: { select: { fixtures: true } }
          }
        }
      }
    });

    tournament = candidates[0] ?? null;
  }

  if (!tournament) {
    throw new Error(
      "Nessun torneo attivo (BRACKET_GENERATED / IN_PROGRESS) trovato."
    );
  }

  if (tournament.status === TournamentStatus.COMPLETED) {
    throw new Error(
      `Torneo "${tournament.name}" e COMPLETED: reset risultati non supportato in questo stato.`
    );
  }

  const roundsWithFixtures = tournament.rounds.filter(
    (round) => round._count.fixtures > 0
  );

  const targetRound =
    options.roundId != null
      ? roundsWithFixtures.find((round) => round.id === options.roundId) ??
        tournament.rounds.find((round) => round.id === options.roundId)
      : roundsWithFixtures[0] ?? null;

  if (!targetRound) {
    throw new Error(
      options.roundId
        ? `Fase ${options.roundId} non trovata nel torneo.`
        : `Torneo "${tournament.name}" non ha fasi con partite.`
    );
  }

  const subsequentRounds = tournament.rounds.filter(
    (round) => round.roundIndex > targetRound.roundIndex
  );

  return { subsequentRounds, targetRound, tournament };
}

/**
 * Clears calculated results for a tournament round (default: first phase),
 * deletes per-leg vote lists for that round, and undoes bracket advancement
 * into later rounds (teams/results/votes). Keeps lineups and per-leg lineupsStatus.
 *
 * Uses sequential autocommit writes (no interactive $transaction) for
 * PgBouncer safety — same pattern as reset-league-data.
 */
export async function resetTournamentRoundResults(
  options: ResolveOptions = {}
): Promise<ResetTournamentRoundResultsSummary> {
  const { subsequentRounds, targetRound, tournament } =
    await resolveTarget(options);

  let deletedRequiredVotes = 0;
  let deletedPlayerVotes = 0;

  const requiredOnTarget =
    await prisma.tournamentRequiredVotePlayer.deleteMany({
      where: { roundId: targetRound.id }
    });
  deletedRequiredVotes += requiredOnTarget.count;

  const votesOnTarget = await prisma.tournamentPlayerVote.deleteMany({
    where: { roundId: targetRound.id }
  });
  deletedPlayerVotes += votesOnTarget.count;

  const resetFixtures = await prisma.tournamentFixture.updateMany({
    where: { roundId: targetRound.id },
    data: {
      awayFantapunti: null,
      awayGoals: null,
      homeFantapunti: null,
      homeGoals: null,
      seriesWinnerTeamId: null,
      status: TournamentFixtureStatus.READY
    }
  });

  let clearedNextRoundTeamSlots = 0;
  let subsequentRoundsCleared = 0;

  for (const laterRound of subsequentRounds) {
    const laterRequired = await prisma.tournamentRequiredVotePlayer.deleteMany({
      where: { roundId: laterRound.id }
    });
    deletedRequiredVotes += laterRequired.count;

    const laterVotes = await prisma.tournamentPlayerVote.deleteMany({
      where: { roundId: laterRound.id }
    });
    deletedPlayerVotes += laterVotes.count;

    const laterFixtures = await prisma.tournamentFixture.updateMany({
      where: { roundId: laterRound.id },
      data: {
        awayFantapunti: null,
        awayGoals: null,
        awayTeamId: null,
        homeFantapunti: null,
        homeGoals: null,
        homeTeamId: null,
        seriesWinnerTeamId: null,
        status: TournamentFixtureStatus.SCHEDULED
      }
    });

    if (
      laterRequired.count > 0 ||
      laterVotes.count > 0 ||
      laterFixtures.count > 0
    ) {
      subsequentRoundsCleared += 1;
    }

    if (laterRound.roundIndex === targetRound.roundIndex + 1) {
      clearedNextRoundTeamSlots += laterFixtures.count;
    }
  }

  // First-round fixtures keep seeded teams; READY is correct when both sides exist.
  // Defensive: any fixture missing a side should be SCHEDULED.
  const incomplete = await prisma.tournamentFixture.findMany({
    where: {
      roundId: targetRound.id,
      OR: [{ homeTeamId: null }, { awayTeamId: null }]
    },
    select: { id: true }
  });

  if (incomplete.length > 0) {
    await prisma.tournamentFixture.updateMany({
      where: { id: { in: incomplete.map((fixture) => fixture.id) } },
      data: { status: TournamentFixtureStatus.SCHEDULED }
    });
  }

  let tournamentStatusAfter = tournament.status;
  const remainingCompleted = await prisma.tournamentFixture.count({
    where: {
      status: TournamentFixtureStatus.COMPLETED,
      round: { tournamentId: tournament.id }
    }
  });

  if (
    remainingCompleted === 0 &&
    tournament.status === TournamentStatus.IN_PROGRESS
  ) {
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.BRACKET_GENERATED }
    });
    tournamentStatusAfter = TournamentStatus.BRACKET_GENERATED;
  }

  return {
    clearedNextRoundTeamSlots,
    deletedPlayerVotes,
    deletedRequiredVotes,
    resetFixtureResults: resetFixtures.count,
    roundId: targetRound.id,
    roundIndex: targetRound.roundIndex,
    roundName: targetRound.name,
    subsequentRoundsCleared,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    tournamentStatusAfter,
    tournamentStatusBefore: tournament.status
  };
}
