import {
  RequiredVoteStatus,
  TournamentFixtureStatus,
  VoteStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  calculatePersistedFantavote,
  validatePlayerVoteInput
} from "@/lib/server/votes/shared.ts";

export async function generateTournamentRequiredVotes(roundId: string) {
  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      name: true,
      fixtures: {
        where: { status: TournamentFixtureStatus.READY },
        select: {
          id: true,
          lineups: {
            select: {
              players: {
                select: { playerId: true }
              }
            }
          }
        }
      }
    }
  });

  if (!round) {
    throw new Error("Fase torneo non trovata.");
  }

  const usage = new Map<string, number>();
  for (const fixture of round.fixtures) {
    for (const lineup of fixture.lineups) {
      for (const player of lineup.players) {
        usage.set(player.playerId, (usage.get(player.playerId) ?? 0) + 1);
      }
    }
  }

  if (usage.size === 0) {
    throw new Error(
      "Nessun giocatore in formazione sulle partite READY di questa fase. Schiera prima le formazioni."
    );
  }

  const existingVotes = await prisma.tournamentPlayerVote.findMany({
    where: { roundId },
    select: { playerId: true, isSv: true }
  });
  const voteByPlayer = new Map(
    existingVotes.map((vote) => [vote.playerId, vote])
  );

  await prisma.$transaction(async (tx) => {
    await tx.tournamentRequiredVotePlayer.deleteMany({
      where: {
        roundId,
        playerId: { notIn: Array.from(usage.keys()) }
      }
    });

    for (const [playerId, usageCount] of usage.entries()) {
      const vote = voteByPlayer.get(playerId);
      const status = vote
        ? vote.isSv
          ? RequiredVoteStatus.SV
          : RequiredVoteStatus.COMPLETED
        : RequiredVoteStatus.PENDING;

      await tx.tournamentRequiredVotePlayer.upsert({
        where: {
          roundId_playerId: { roundId, playerId }
        },
        create: {
          playerId,
          roundId,
          status,
          usageCount
        },
        update: {
          status,
          usageCount
        }
      });
    }
  });

  return {
    playerCount: usage.size,
    roundId,
    roundName: round.name
  };
}

export async function saveTournamentPlayerVote(input: {
  assists?: number;
  baseVote: number | null;
  goals?: number;
  goalsConceded?: number;
  isSv: boolean;
  notes?: string | null;
  ownGoals?: number;
  penaltiesMissed?: number;
  penaltiesSaved?: number;
  penaltiesScored?: number;
  playerId: string;
  redCards?: number;
  tournamentRoundId: string;
  yellowCards?: number;
}) {
  const validated = validatePlayerVoteInput({
    ...input,
    matchdayId: input.tournamentRoundId
  });

  const player = await prisma.player.findUnique({
    where: { id: validated.playerId },
    select: { role: true }
  });

  if (!player) {
    throw new Error("Giocatore non trovato.");
  }

  const isGoalkeeper = player.role === "GOALKEEPER";
  const goalsConceded = isGoalkeeper ? validated.goalsConceded : 0;
  const cleanSheet =
    !validated.isSv && isGoalkeeper && goalsConceded === 0 ? 1 : 0;
  const voteForPersist = {
    ...validated,
    cleanSheet,
    goalsConceded
  };
  const { finalFantavote, requiredVoteStatus } =
    calculatePersistedFantavote(voteForPersist);

  await prisma.$transaction(async (tx) => {
    await tx.tournamentPlayerVote.upsert({
      where: {
        roundId_playerId: {
          playerId: voteForPersist.playerId,
          roundId: input.tournamentRoundId
        }
      },
      create: {
        assists: voteForPersist.assists,
        baseVote: voteForPersist.baseVote,
        cleanSheet: voteForPersist.cleanSheet,
        finalFantavote,
        goals: voteForPersist.goals,
        goalsConceded: voteForPersist.goalsConceded,
        isSv: voteForPersist.isSv,
        notes: voteForPersist.notes,
        ownGoals: voteForPersist.ownGoals,
        penaltiesMissed: voteForPersist.penaltiesMissed,
        penaltiesSaved: voteForPersist.penaltiesSaved,
        penaltiesScored: voteForPersist.penaltiesScored,
        playerId: voteForPersist.playerId,
        redCards: voteForPersist.redCards,
        roundId: input.tournamentRoundId,
        status: VoteStatus.CONFIRMED,
        yellowCards: voteForPersist.yellowCards
      },
      update: {
        assists: voteForPersist.assists,
        baseVote: voteForPersist.baseVote,
        cleanSheet: voteForPersist.cleanSheet,
        finalFantavote,
        goals: voteForPersist.goals,
        goalsConceded: voteForPersist.goalsConceded,
        isSv: voteForPersist.isSv,
        notes: voteForPersist.notes,
        ownGoals: voteForPersist.ownGoals,
        penaltiesMissed: voteForPersist.penaltiesMissed,
        penaltiesSaved: voteForPersist.penaltiesSaved,
        penaltiesScored: voteForPersist.penaltiesScored,
        redCards: voteForPersist.redCards,
        status: VoteStatus.CONFIRMED,
        yellowCards: voteForPersist.yellowCards
      }
    });

    await tx.tournamentRequiredVotePlayer.updateMany({
      where: {
        playerId: voteForPersist.playerId,
        roundId: input.tournamentRoundId
      },
      data: { status: requiredVoteStatus }
    });
  });
}
