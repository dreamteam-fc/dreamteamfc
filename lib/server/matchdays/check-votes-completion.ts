import { MatchdayStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { isRequiredVoteCompletedStatus } from "../votes/shared.ts";

export type CheckVotesCompletionResult = {
  completedCount: number;
  isComplete: boolean;
  matchdayId: string;
  missingCount: number;
  missingRecords: Array<{
    playerId: string;
    playerName: string;
    status: string;
    usageCount: number;
  }>;
  totalRequired: number;
};

/**
 * Evaluate required-vote completion and optionally move the matchday to
 * VOTES_COMPLETED. No interactive `$transaction` — pooler-safe plain reads/writes.
 */
export async function checkVotesCompletion(
  matchdayId: string
): Promise<CheckVotesCompletionResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    select: { id: true }
  });

  if (!matchday) {
    throw new Error(`Matchday ${matchdayId} not found.`);
  }

  const requiredVotePlayers = await prisma.requiredVotePlayer.findMany({
    where: { matchdayId },
    include: {
      player: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ usageCount: "desc" }, { playerId: "asc" }]
  });

  const completedRecords = requiredVotePlayers.filter((record) =>
    isRequiredVoteCompletedStatus(record.status)
  );
  const missingRecords = requiredVotePlayers
    .filter((record) => !isRequiredVoteCompletedStatus(record.status))
    .map((record) => ({
      playerId: record.player.id,
      playerName: record.player.name,
      status: record.status,
      usageCount: record.usageCount
    }));

  const result: CheckVotesCompletionResult = {
    completedCount: completedRecords.length,
    isComplete:
      requiredVotePlayers.length > 0 && missingRecords.length === 0,
    matchdayId,
    missingCount: missingRecords.length,
    missingRecords,
    totalRequired: requiredVotePlayers.length
  };

  if (result.isComplete) {
    await prisma.matchday.update({
      where: { id: matchdayId },
      data: {
        status: MatchdayStatus.VOTES_COMPLETED
      }
    });
  }

  return result;
}
