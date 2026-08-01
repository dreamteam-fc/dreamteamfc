import { VoteStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import {
  calculatePersistedFantavote,
  validatePlayerVoteInput,
  type SavePlayerVoteInput
} from "./shared.ts";

export type SavePlayerVoteResult = {
  finalFantavote: number | null;
  matchdayId: string;
  playerId: string;
  playerVoteId: string;
  requiredVoteStatus: string;
};

export async function savePlayerVote(
  input: SavePlayerVoteInput
): Promise<SavePlayerVoteResult> {
  const validatedInput = validatePlayerVoteInput(input);

  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({
      where: { id: validatedInput.playerId },
      select: { role: true }
    });

    if (!player) {
      throw new Error("Giocatore non trovato.");
    }

    const isGoalkeeper = player.role === "GOALKEEPER";
    const goalsConceded = isGoalkeeper ? validatedInput.goalsConceded : 0;
    const cleanSheet =
      !validatedInput.isSv && isGoalkeeper && goalsConceded === 0 ? 1 : 0;

    const voteForPersist = {
      ...validatedInput,
      cleanSheet,
      goalsConceded
    };
    const { finalFantavote, requiredVoteStatus } =
      calculatePersistedFantavote(voteForPersist);

    const playerVote = await tx.playerVote.upsert({
      where: {
        matchdayId_playerId: {
          matchdayId: voteForPersist.matchdayId,
          playerId: voteForPersist.playerId
        }
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
      },
      create: {
        assists: voteForPersist.assists,
        baseVote: voteForPersist.baseVote,
        cleanSheet: voteForPersist.cleanSheet,
        finalFantavote,
        goals: voteForPersist.goals,
        goalsConceded: voteForPersist.goalsConceded,
        isSv: voteForPersist.isSv,
        matchdayId: voteForPersist.matchdayId,
        notes: voteForPersist.notes,
        ownGoals: voteForPersist.ownGoals,
        penaltiesMissed: voteForPersist.penaltiesMissed,
        penaltiesSaved: voteForPersist.penaltiesSaved,
        penaltiesScored: voteForPersist.penaltiesScored,
        playerId: voteForPersist.playerId,
        redCards: voteForPersist.redCards,
        status: VoteStatus.CONFIRMED,
        yellowCards: voteForPersist.yellowCards
      },
      select: {
        id: true,
        finalFantavote: true,
        matchdayId: true,
        playerId: true
      }
    });

    await tx.requiredVotePlayer.upsert({
      where: {
        matchdayId_playerId: {
          matchdayId: voteForPersist.matchdayId,
          playerId: voteForPersist.playerId
        }
      },
      update: {
        status: requiredVoteStatus
      },
      create: {
        matchdayId: voteForPersist.matchdayId,
        playerId: voteForPersist.playerId,
        status: requiredVoteStatus,
        usageCount: 1
      }
    });

    return {
      finalFantavote:
        playerVote.finalFantavote === null
          ? null
          : playerVote.finalFantavote.toNumber(),
      matchdayId: playerVote.matchdayId,
      playerId: playerVote.playerId,
      playerVoteId: playerVote.id,
      requiredVoteStatus
    };
  });
}
