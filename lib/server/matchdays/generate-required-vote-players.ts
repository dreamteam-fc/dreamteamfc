import { MatchdayStatus, RequiredVoteStatus } from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { deriveRequiredVoteStatusFromStoredVote } from "../votes/shared.ts";

export type GenerateRequiredVotePlayersResult = {
  createdCount: number;
  ignoredCount: number;
  matchdayId: string;
  totalRequired: number;
  updatedCount: number;
};

type RequiredVoteWriteRow = {
  matchdayId: string;
  playerId: string;
  status: RequiredVoteStatus;
  usageCount: number;
};

/**
 * Build the useful/required vote player list for a matchday.
 *
 * Intentionally avoids interactive `$transaction`: Supabase PgBouncer
 * (Transaction :6543 and often Session :5432 under load) drops long Prisma
 * interactive txs mid-flight with "Transaction not found...".
 *
 * Durable approach (same as calendar gen): precompute in memory, then write
 * with plain updateMany / createMany in chunks — no interactive tx spanning
 * dozens of upserts.
 */
export async function generateRequiredVotePlayers(
  matchdayId: string
): Promise<GenerateRequiredVotePlayersResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    select: {
      id: true,
      status: true
    }
  });

  if (!matchday) {
    throw new Error(`Matchday ${matchdayId} not found.`);
  }

  const lineupPlayers = await prisma.lineupPlayer.findMany({
    where: {
      lineup: {
        matchdayId
      }
    },
    select: {
      playerId: true
    }
  });

  const usageByPlayerId = new Map<string, number>();
  for (const lineupPlayer of lineupPlayers) {
    usageByPlayerId.set(
      lineupPlayer.playerId,
      (usageByPlayerId.get(lineupPlayer.playerId) ?? 0) + 1
    );
  }

  const playerIds = Array.from(usageByPlayerId.keys());
  const existingRequiredVotePlayers = await prisma.requiredVotePlayer.findMany({
    where: { matchdayId },
    select: {
      id: true,
      playerId: true
    }
  });

  const existingVotes = playerIds.length
    ? await prisma.playerVote.findMany({
        where: {
          matchdayId,
          playerId: {
            in: playerIds
          }
        },
        select: {
          playerId: true,
          isSv: true
        }
      })
    : [];

  const votesByPlayerId = new Map(
    existingVotes.map((vote) => [vote.playerId, vote])
  );
  const existingPlayerIds = new Set(
    existingRequiredVotePlayers.map((record) => record.playerId)
  );

  const stalePlayerIds = existingRequiredVotePlayers
    .filter((record) => !usageByPlayerId.has(record.playerId))
    .map((record) => record.playerId);

  const rowsToWrite: RequiredVoteWriteRow[] = playerIds.map((playerId) => ({
    matchdayId,
    playerId,
    status: deriveRequiredVoteStatusFromStoredVote(
      votesByPlayerId.get(playerId)
    ),
    usageCount: usageByPlayerId.get(playerId) ?? 0
  }));

  const createRows = rowsToWrite.filter(
    (row) => !existingPlayerIds.has(row.playerId)
  );
  const updateRows = rowsToWrite.filter((row) =>
    existingPlayerIds.has(row.playerId)
  );

  const ignoredCount = stalePlayerIds.length
    ? (
        await prisma.requiredVotePlayer.updateMany({
          where: {
            matchdayId,
            playerId: {
              in: stalePlayerIds
            }
          },
          data: {
            status: RequiredVoteStatus.IGNORED,
            usageCount: 0
          }
        })
      ).count
    : 0;

  if (createRows.length > 0) {
    await createRequiredVotePlayersInChunks(createRows);
  }

  await updateRequiredVotePlayersByGroup(matchdayId, updateRows);

  const shouldMoveToVotesPending =
    playerIds.length > 0 &&
    (matchday.status === MatchdayStatus.DRAFT ||
      matchday.status === MatchdayStatus.LINEUPS_OPEN ||
      matchday.status === MatchdayStatus.LINEUPS_LOCKED);

  if (shouldMoveToVotesPending) {
    await prisma.matchday.update({
      where: { id: matchdayId },
      data: {
        status: MatchdayStatus.VOTES_PENDING
      }
    });
  }

  return {
    createdCount: createRows.length,
    ignoredCount,
    matchdayId,
    totalRequired: playerIds.length,
    updatedCount: updateRows.length
  };
}

async function createRequiredVotePlayersInChunks(
  rows: RequiredVoteWriteRow[],
  chunkSize = 50
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await prisma.requiredVotePlayer.createMany({
      data: chunk,
      skipDuplicates: true
    });
  }
}

async function updateRequiredVotePlayersByGroup(
  matchdayId: string,
  rows: RequiredVoteWriteRow[],
  chunkSize = 50
) {
  const groups = new Map<
    string,
    { playerIds: string[]; status: RequiredVoteStatus; usageCount: number }
  >();

  for (const row of rows) {
    const key = `${row.status}:${row.usageCount}`;
    const group = groups.get(key);
    if (group) {
      group.playerIds.push(row.playerId);
    } else {
      groups.set(key, {
        playerIds: [row.playerId],
        status: row.status,
        usageCount: row.usageCount
      });
    }
  }

  for (const group of groups.values()) {
    for (let index = 0; index < group.playerIds.length; index += chunkSize) {
      const chunk = group.playerIds.slice(index, index + chunkSize);
      await prisma.requiredVotePlayer.updateMany({
        where: {
          matchdayId,
          playerId: {
            in: chunk
          }
        },
        data: {
          status: group.status,
          usageCount: group.usageCount
        }
      });
    }
  }
}
