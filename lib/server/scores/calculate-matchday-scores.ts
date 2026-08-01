import {
  MatchdayStatus,
  Prisma,
  ScorePlayerFinalType,
  ScoreStatus
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

function toDecimal(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

export async function calculateMatchdayScores(
  matchdayId: string
): Promise<CalculateMatchdayScoresResult> {
  return prisma.$transaction(async (tx) => {
    const matchday = await tx.matchday.findUnique({
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

    const teamsScored: CalculateMatchdayScoresResult["teamsScored"] = [];

    for (const lineup of matchday.lineups) {
      const teamScoreInput = {
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
      };

      const calculation = calculateTeamScore(teamScoreInput);

      const teamScore = await tx.teamScore.upsert({
        where: {
          fantasyTeamId_matchdayId: {
            fantasyTeamId: lineup.fantasyTeam.id,
            matchdayId: matchday.id
          }
        },
        update: {
          autoSubsUsed: calculation.substitutionsCount,
          lineupId: lineup.id,
          publishedAt: null,
          status: ScoreStatus.CALCULATED,
          totalScore: toDecimal(calculation.totalScore)
        },
        create: {
          autoSubsUsed: calculation.substitutionsCount,
          fantasyTeamId: lineup.fantasyTeam.id,
          lineupId: lineup.id,
          matchdayId: matchday.id,
          publishedAt: null,
          status: ScoreStatus.CALCULATED,
          totalScore: toDecimal(calculation.totalScore)
        },
        select: {
          id: true,
          fantasyTeamId: true,
          lineupId: true
        }
      });

      await tx.teamScorePlayer.deleteMany({
        where: {
          teamScoreId: teamScore.id
        }
      });

      await tx.teamScorePlayer.createMany({
        data: calculation.detailLines.map((detailLine) => {
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
            slotType: detailLine.slotType,
            teamScoreId: teamScore.id
          };
        })
      });

      teamsScored.push({
        autoSubsUsed: calculation.substitutionsCount,
        fantasyTeamId: teamScore.fantasyTeamId,
        lineupId: teamScore.lineupId,
        teamScoreId: teamScore.id,
        totalScore: calculation.totalScore
      });
    }

    await tx.matchday.update({
      where: { id: matchdayId },
      data: {
        status: MatchdayStatus.SCORES_CALCULATED
      }
    });

    return {
      matchdayId,
      teamsScored
    };
  });
}
