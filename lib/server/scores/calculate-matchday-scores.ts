import {
  MatchdayStatus,
  Prisma,
  ScorePlayerFinalType,
  ScoreStatus,
  SlotType
} from "@prisma/client";

import { prisma } from "../../prisma.ts";
import { calculateTeamScore } from "../../scoring/calculate-team-score.ts";
import { prismaDecimalToNumber, isRequiredVoteCompletedStatus } from "../votes/shared.ts";

export type CalculateMatchdayScoresResult = {
  matchdayId: string;
  teamsScored: Array<{
    autoSubsUsed: number;
    fantasyTeamId: string;
    lineupId: string;
    teamScoreId: string;
    totalScore: number;
  }>;
};

type ComputedTeamScore = {
  autoSubsUsed: number;
  fantasyTeamId: string;
  lineupId: string;
  playerRows: Array<{
    countsForScore: boolean;
    finalFantavote: Prisma.Decimal | null;
    finalType: ScorePlayerFinalType;
    isSv: boolean;
    lineupPlayerId: string;
    playerId: string;
    playerVoteId: string | null;
    positionOrder: number;
    replacedLineupPlayerId: string | null;
    slotType: SlotType;
  }>;
  totalScore: number;
};

function toDecimal(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

/**
 * Calculate team scores for every lineup on a matchday.
 *
 * Intentionally avoids interactive `$transaction`: Supabase PgBouncer
 * (Transaction :6543 and often Session :5432 under load) drops long Prisma
 * interactive txs mid-flight with "Transaction not found...".
 *
 * Durable approach (same as calendar / required-vote gen): precompute in
 * memory, then write with plain createMany / update / deleteMany in chunks —
 * no interactive tx spanning dozens of upserts.
 */
export async function calculateMatchdayScores(
  matchdayId: string
): Promise<CalculateMatchdayScoresResult> {
  const matchday = await prisma.matchday.findUnique({
    where: { id: matchdayId },
    include: {
      league: {
        select: {
          id: true,
          maxAutoSubs: true,
          startersCount: true
        }
      },
      lineups: {
        include: {
          fantasyTeam: {
            select: {
              id: true
            }
          },
          players: {
            include: {
              player: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            }
          }
        }
      },
      playerVotes: true,
      requiredVotes: true
    }
  });

  if (!matchday) {
    throw new Error(`Matchday ${matchdayId} not found.`);
  }

  if (
    matchday.status === MatchdayStatus.PUBLISHED ||
    matchday.status === MatchdayStatus.LOCKED
  ) {
    throw new Error(
      `Matchday ${matchdayId} cannot be recalculated from status ${matchday.status}.`
    );
  }

  if (matchday.requiredVotes.length === 0) {
    throw new Error(
      `Matchday ${matchdayId} has no required vote players. Generate them first.`
    );
  }

  const missingRequiredVotes = matchday.requiredVotes.filter(
    (requiredVote) => !isRequiredVoteCompletedStatus(requiredVote.status)
  );

  if (missingRequiredVotes.length > 0) {
    throw new Error(
      `Matchday ${matchdayId} cannot be scored because ${missingRequiredVotes.length} required votes are still missing.`
    );
  }

  const playerVotesByPlayerId = new Map(
    matchday.playerVotes.map((playerVote) => [playerVote.playerId, playerVote])
  );

  const computed: ComputedTeamScore[] = matchday.lineups.map((lineup) => {
    const calculation = calculateTeamScore({
      lineupPlayers: lineup.players.map((lineupPlayer) => {
        const playerVote = playerVotesByPlayerId.get(lineupPlayer.playerId);

        return {
          lineupPlayerId: lineupPlayer.id,
          playerId: lineupPlayer.player.id,
          playerName: lineupPlayer.player.name,
          positionOrder: lineupPlayer.positionOrder,
          role: lineupPlayer.player.role,
          slotType: lineupPlayer.slotType,
          vote: playerVote
            ? {
                assists: playerVote.assists,
                baseVote: prismaDecimalToNumber(playerVote.baseVote),
                cleanSheet: playerVote.cleanSheet,
                goals: playerVote.goals,
                goalsConceded: playerVote.goalsConceded,
                isSv: playerVote.isSv,
                ownGoals: playerVote.ownGoals,
                penaltiesMissed: playerVote.penaltiesMissed,
                penaltiesSaved: playerVote.penaltiesSaved,
                playerVoteId: playerVote.id,
                redCards: playerVote.redCards,
                yellowCards: playerVote.yellowCards
              }
            : null
        };
      }),
      maxSubstitutions: matchday.league.maxAutoSubs,
      startersCount: matchday.league.startersCount
    });

    return {
      autoSubsUsed: calculation.substitutionsCount,
      fantasyTeamId: lineup.fantasyTeam.id,
      lineupId: lineup.id,
      playerRows: calculation.detailLines.map((detailLine) => {
        if (!detailLine.lineupPlayerId) {
          throw new Error("Missing lineupPlayerId in team score detail line.");
        }

        return {
          countsForScore: detailLine.countsForScore,
          finalFantavote: toDecimal(detailLine.finalFantavote),
          finalType: detailLine.finalType,
          isSv: detailLine.isSv,
          lineupPlayerId: detailLine.lineupPlayerId,
          playerId: detailLine.playerId,
          playerVoteId: detailLine.playerVoteId ?? null,
          positionOrder: detailLine.positionOrder,
          replacedLineupPlayerId:
            detailLine.finalType === ScorePlayerFinalType.AUTO_SUB_IN
              ? detailLine.replacedStarterLineupPlayerId ?? null
              : null,
          slotType: detailLine.slotType
        };
      }),
      totalScore: calculation.totalScore
    };
  });

  const existingScores = await prisma.teamScore.findMany({
    where: { matchdayId },
    select: {
      fantasyTeamId: true,
      id: true
    }
  });
  const existingByFantasyTeamId = new Map(
    existingScores.map((score) => [score.fantasyTeamId, score.id])
  );

  const createRows = computed.filter(
    (item) => !existingByFantasyTeamId.has(item.fantasyTeamId)
  );
  const updateRows = computed.filter((item) =>
    existingByFantasyTeamId.has(item.fantasyTeamId)
  );

  const UPDATE_CONCURRENCY = 10;
  for (let index = 0; index < updateRows.length; index += UPDATE_CONCURRENCY) {
    const chunk = updateRows.slice(index, index + UPDATE_CONCURRENCY);
    await Promise.all(
      chunk.map(async (item) => {
        const teamScoreId = existingByFantasyTeamId.get(item.fantasyTeamId);
        if (!teamScoreId) {
          return;
        }

        await prisma.teamScore.update({
          where: { id: teamScoreId },
          data: {
            autoSubsUsed: item.autoSubsUsed,
            lineupId: item.lineupId,
            publishedAt: null,
            status: ScoreStatus.CALCULATED,
            totalScore: toDecimal(item.totalScore)
          }
        });
      })
    );
  }

  if (createRows.length > 0) {
    await createTeamScoresInChunks(
      createRows.map((item) => ({
        autoSubsUsed: item.autoSubsUsed,
        fantasyTeamId: item.fantasyTeamId,
        lineupId: item.lineupId,
        matchdayId,
        publishedAt: null,
        status: ScoreStatus.CALCULATED,
        totalScore: toDecimal(item.totalScore)
      }))
    );
  }

  const fantasyTeamIds = computed.map((item) => item.fantasyTeamId);
  const resolvedScores =
    fantasyTeamIds.length > 0
      ? await prisma.teamScore.findMany({
          where: {
            matchdayId,
            fantasyTeamId: {
              in: fantasyTeamIds
            }
          },
          select: {
            fantasyTeamId: true,
            id: true,
            lineupId: true
          }
        })
      : [];

  const resolvedByFantasyTeamId = new Map(
    resolvedScores.map((score) => [score.fantasyTeamId, score])
  );

  const computedByFantasyTeamId = new Map(
    computed.map((item) => [item.fantasyTeamId, item])
  );

  const touchedScoreIds = resolvedScores.map((score) => score.id);
  if (touchedScoreIds.length > 0) {
    await prisma.teamScorePlayer.deleteMany({
      where: {
        teamScoreId: {
          in: touchedScoreIds
        }
      }
    });
  }

  const playerRows = resolvedScores.flatMap((score) => {
    const item = computedByFantasyTeamId.get(score.fantasyTeamId);
    if (!item) {
      return [];
    }

    return item.playerRows.map((playerRow) => ({
      ...playerRow,
      teamScoreId: score.id
    }));
  });

  if (playerRows.length > 0) {
    await createTeamScorePlayersInChunks(playerRows);
  }

  await prisma.matchday.update({
    where: { id: matchdayId },
    data: {
      status: MatchdayStatus.SCORES_CALCULATED
    }
  });

  const teamsScored: CalculateMatchdayScoresResult["teamsScored"] = [];
  for (const item of computed) {
    const resolved = resolvedByFantasyTeamId.get(item.fantasyTeamId);
    if (!resolved) {
      throw new Error(
        `TeamScore for fantasy team ${item.fantasyTeamId} was not persisted.`
      );
    }

    teamsScored.push({
      autoSubsUsed: item.autoSubsUsed,
      fantasyTeamId: item.fantasyTeamId,
      lineupId: item.lineupId,
      teamScoreId: resolved.id,
      totalScore: item.totalScore
    });
  }

  return {
    matchdayId,
    teamsScored
  };
}

async function createTeamScoresInChunks(
  rows: Array<{
    autoSubsUsed: number;
    fantasyTeamId: string;
    lineupId: string;
    matchdayId: string;
    publishedAt: null;
    status: typeof ScoreStatus.CALCULATED;
    totalScore: Prisma.Decimal | null;
  }>,
  chunkSize = 50
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await prisma.teamScore.createMany({
      data: chunk,
      skipDuplicates: true
    });
  }
}

async function createTeamScorePlayersInChunks(
  rows: Array<{
    countsForScore: boolean;
    finalFantavote: Prisma.Decimal | null;
    finalType: ScorePlayerFinalType;
    isSv: boolean;
    lineupPlayerId: string;
    playerId: string;
    playerVoteId: string | null;
    positionOrder: number;
    replacedLineupPlayerId: string | null;
    slotType: SlotType;
    teamScoreId: string;
  }>,
  chunkSize = 100
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await prisma.teamScorePlayer.createMany({
      data: chunk
    });
  }
}
