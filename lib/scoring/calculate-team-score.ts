import { PlayerRole, ScorePlayerFinalType, SlotType } from "@prisma/client";

import { BENCH_POSITION_ORDER_BY_ROLE } from "../lineups/bench-position-order.ts";
import { calculateFantavote } from "./calculate-fantavote.ts";
import type {
  FantavoteCalculation,
  TeamScoreCalculation,
  TeamScoreDetailLine,
  TeamScoreInput,
  TeamScoreLineupPlayerInput
} from "./types.ts";

type ResolvedVote = FantavoteCalculation & {
  note?: string;
  playerVoteId?: string;
};

/**
 * Product default: at most one automatic substitution per role.
 * Bench is exactly 1P / 1D / 1C / 1A → ceiling of 4 substitutions per team.
 */
export const DEFAULT_MAX_SUBSTITUTIONS = 4;
const DEFAULT_STARTERS_COUNT = 5;

function compareBenchPlayers(
  left: TeamScoreLineupPlayerInput,
  right: TeamScoreLineupPlayerInput
) {
  const roleDelta =
    BENCH_POSITION_ORDER_BY_ROLE[left.role] -
    BENCH_POSITION_ORDER_BY_ROLE[right.role];
  if (roleDelta !== 0) {
    return roleDelta;
  }

  return left.positionOrder - right.positionOrder;
}

function findSameRoleBenchReplacement(
  starter: TeamScoreLineupPlayerInput,
  bench: TeamScoreLineupPlayerInput[],
  usedBenchKeys: Set<string>,
  usedSubstitutionRoles: Set<PlayerRole>,
  resolveBenchVote: (player: TeamScoreLineupPlayerInput) => ResolvedVote
):
  | {
      player: TeamScoreLineupPlayerInput;
      resolvedVote: ResolvedVote;
    }
  | undefined {
  if (usedSubstitutionRoles.has(starter.role)) {
    return undefined;
  }

  for (const benchPlayer of bench) {
    if (benchPlayer.role !== starter.role) {
      continue;
    }

    const benchKey = getLineupPlayerKey(benchPlayer);
    if (usedBenchKeys.has(benchKey)) {
      continue;
    }

    const benchVote = resolveBenchVote(benchPlayer);
    if (!benchVote.hasValidFantavote || benchVote.finalFantavote === null) {
      continue;
    }

    return {
      player: benchPlayer,
      resolvedVote: benchVote
    };
  }

  return undefined;
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getLineupPlayerKey(player: TeamScoreLineupPlayerInput): string {
  return player.lineupPlayerId ?? player.playerId;
}

function resolveVote(player: TeamScoreLineupPlayerInput): ResolvedVote {
  if (!player.vote) {
    return {
      assists: 0,
      baseVote: null,
      bonusPoints: 0,
      cleanSheet: 0,
      finalFantavote: null,
      goals: 0,
      goalsConceded: 0,
      hasValidFantavote: false,
      isSv: false,
      malusPoints: 0,
      note: "Missing vote",
      ownGoals: 0,
      penaltiesMissed: 0,
      penaltiesSaved: 0,
      playerVoteId: undefined,
      redCards: 0,
      yellowCards: 0
    };
  }

  try {
    return {
      ...calculateFantavote(player.vote),
      note: player.vote.isSv ? "SV" : undefined,
      playerVoteId: player.vote.playerVoteId
    };
  } catch (error) {
    return {
      assists: player.vote.assists ?? 0,
      baseVote: player.vote.baseVote,
      bonusPoints: 0,
      cleanSheet: player.vote.cleanSheet ?? 0,
      finalFantavote: null,
      goals: player.vote.goals ?? 0,
      goalsConceded: player.vote.goalsConceded ?? 0,
      hasValidFantavote: false,
      isSv: player.vote.isSv,
      malusPoints: 0,
      note: error instanceof Error ? error.message : "Invalid vote",
      ownGoals: player.vote.ownGoals ?? 0,
      penaltiesMissed: player.vote.penaltiesMissed ?? 0,
      penaltiesSaved: player.vote.penaltiesSaved ?? 0,
      playerVoteId: player.vote.playerVoteId,
      redCards: player.vote.redCards ?? 0,
      yellowCards: player.vote.yellowCards ?? 0
    };
  }
}

function createDetailLine(
  player: TeamScoreLineupPlayerInput,
  resolvedVote: ResolvedVote,
  overrides: Omit<TeamScoreDetailLine, "isSv" | "lineupPlayerId" | "playerId" | "playerName" | "playerVoteId" | "positionOrder" | "slotType">
): TeamScoreDetailLine {
  return {
    isSv: resolvedVote.isSv,
    lineupPlayerId: player.lineupPlayerId,
    playerId: player.playerId,
    playerName: player.playerName,
    playerVoteId: resolvedVote.playerVoteId,
    positionOrder: player.positionOrder,
    slotType: player.slotType,
    ...overrides
  };
}

function assertValidLineupShape(
  lineupPlayers: TeamScoreLineupPlayerInput[],
  startersCount: number
) {
  const starters = lineupPlayers.filter(
    (player) => player.slotType === SlotType.STARTER
  );

  if (starters.length !== startersCount) {
    throw new Error(
      `Expected ${startersCount} starters, received ${starters.length}.`
    );
  }

  const playerIds = new Set<string>();
  const slotOrders = new Set<string>();

  for (const player of lineupPlayers) {
    if (playerIds.has(player.playerId)) {
      throw new Error(`Duplicate player detected in lineup: ${player.playerId}`);
    }

    playerIds.add(player.playerId);

    const slotOrderKey = `${player.slotType}:${player.positionOrder}`;
    if (slotOrders.has(slotOrderKey)) {
      throw new Error(`Duplicate slot order detected: ${slotOrderKey}`);
    }

    slotOrders.add(slotOrderKey);
  }
}

export function calculateTeamScore(
  input: TeamScoreInput
): TeamScoreCalculation {
  const maxSubstitutions =
    input.maxSubstitutions ?? DEFAULT_MAX_SUBSTITUTIONS;
  const startersCount = input.startersCount ?? DEFAULT_STARTERS_COUNT;

  assertValidLineupShape(input.lineupPlayers, startersCount);

  const starters = input.lineupPlayers
    .filter((player) => player.slotType === SlotType.STARTER)
    .sort((left, right) => left.positionOrder - right.positionOrder);
  // Bench order is role-stable for display/DB uniqueness; subs match by role only.
  const bench = input.lineupPlayers
    .filter((player) => player.slotType === SlotType.BENCH)
    .sort(compareBenchPlayers);

  const detailLines: TeamScoreDetailLine[] = [];
  const usedBenchKeys = new Set<string>();
  const usedBenchPlayerIds = new Set<string>();
  const usedSubstitutionRoles = new Set<PlayerRole>();
  let substitutionsCount = 0;
  let totalScore = 0;

  for (const starter of starters) {
    const starterVote = resolveVote(starter);

    if (starterVote.hasValidFantavote && starterVote.finalFantavote !== null) {
      totalScore += starterVote.finalFantavote;
      detailLines.push(
        createDetailLine(starter, starterVote, {
          countsForScore: true,
          finalFantavote: starterVote.finalFantavote,
          finalType: ScorePlayerFinalType.STARTER_PLAYED,
          note: starterVote.note,
          scoreUsed: starterVote.finalFantavote
        })
      );
      continue;
    }

    // SV / missing / invalid vote: try same-role bench with a valid fantavote.
    // One sub per role (bench has one slot each); a second SV of that role stays 0.
    let replacement:
      | {
          player: TeamScoreLineupPlayerInput;
          resolvedVote: ResolvedVote;
        }
      | undefined;

    if (substitutionsCount < maxSubstitutions) {
      replacement = findSameRoleBenchReplacement(
        starter,
        bench,
        usedBenchKeys,
        usedSubstitutionRoles,
        resolveVote
      );

      if (replacement) {
        const benchKey = getLineupPlayerKey(replacement.player);
        usedBenchKeys.add(benchKey);
        usedBenchPlayerIds.add(replacement.player.playerId);
        usedSubstitutionRoles.add(starter.role);
        substitutionsCount += 1;
      }
    }

    if (!replacement) {
      detailLines.push(
        createDetailLine(starter, starterVote, {
          countsForScore: true,
          finalFantavote: null,
          finalType: ScorePlayerFinalType.SV_NOT_REPLACED,
          note: starterVote.note ?? "No valid replacement found",
          scoreUsed: 0
        })
      );
      continue;
    }

    detailLines.push(
      createDetailLine(starter, starterVote, {
        countsForScore: false,
        finalFantavote: null,
        finalType: ScorePlayerFinalType.REPLACED_BY_BENCH,
        note: starterVote.note ?? "Replaced by bench",
        replacedStarterLineupPlayerId: starter.lineupPlayerId,
        replacedStarterPlayerId: starter.playerId,
        replacedStarterPlayerName: starter.playerName,
        scoreUsed: 0
      })
    );

    const replacementScore = replacement.resolvedVote.finalFantavote;
    if (replacementScore === null) {
      throw new Error("Replacement player must have a valid fantavote.");
    }

    totalScore += replacementScore;
    detailLines.push(
      createDetailLine(replacement.player, replacement.resolvedVote, {
        countsForScore: true,
        finalFantavote: replacementScore,
        finalType: ScorePlayerFinalType.AUTO_SUB_IN,
        note: "Automatic substitution",
        replacedStarterLineupPlayerId: starter.lineupPlayerId,
        replacedStarterPlayerId: starter.playerId,
        replacedStarterPlayerName: starter.playerName,
        scoreUsed: replacementScore
      })
    );
  }

  for (const benchPlayer of bench) {
    const benchKey = getLineupPlayerKey(benchPlayer);
    if (usedBenchKeys.has(benchKey)) {
      continue;
    }

    const benchVote = resolveVote(benchPlayer);
    detailLines.push(
      createDetailLine(benchPlayer, benchVote, {
        countsForScore: false,
        finalFantavote: benchVote.finalFantavote,
        finalType: ScorePlayerFinalType.BENCH_UNUSED,
        note: benchVote.note ?? "Bench player not used",
        scoreUsed: 0
      })
    );
  }

  return {
    detailLines,
    maxSubstitutions,
    startersCount,
    substitutionsCount,
    totalScore: roundToTwoDecimals(totalScore),
    unusedBenchPlayerIds: bench
      .filter((player) => !usedBenchKeys.has(getLineupPlayerKey(player)))
      .map((player) => player.playerId),
    usedBenchPlayerIds: Array.from(usedBenchPlayerIds)
  };
}
