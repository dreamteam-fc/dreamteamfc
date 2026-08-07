import type { PlayerRole, ScorePlayerFinalType, SlotType } from "@prisma/client";

export type FantavoteInput = {
  assists?: number;
  baseVote: number | null;
  cleanSheet?: number;
  /** Gf: gol non da rigore. */
  goals?: number;
  goalsConceded?: number;
  isSv: boolean;
  ownGoals?: number;
  penaltiesMissed?: number;
  penaltiesSaved?: number;
  /** Rf: gol da rigore; +3 ciascuno, additivo rispetto a Gf. */
  penaltiesScored?: number;
  redCards?: number;
  yellowCards?: number;
};

export type FantavoteCalculation = FantavoteInput & {
  bonusPoints: number;
  finalFantavote: number | null;
  hasValidFantavote: boolean;
  malusPoints: number;
};

export type TeamScoreVoteInput = FantavoteInput & {
  playerVoteId?: string;
};

export type TeamScoreLineupPlayerInput = {
  lineupPlayerId?: string;
  playerId: string;
  playerName: string;
  positionOrder: number;
  role: PlayerRole;
  slotType: SlotType;
  vote?: TeamScoreVoteInput | null;
};

export type TeamScoreInput = {
  lineupPlayers: TeamScoreLineupPlayerInput[];
  maxSubstitutions?: number;
  startersCount?: number;
};

export type TeamScoreDetailLine = {
  countsForScore: boolean;
  finalFantavote: number | null;
  finalType: ScorePlayerFinalType;
  isSv: boolean;
  lineupPlayerId?: string;
  note?: string;
  playerId: string;
  playerName: string;
  playerVoteId?: string;
  positionOrder: number;
  replacedStarterLineupPlayerId?: string;
  replacedStarterPlayerId?: string;
  replacedStarterPlayerName?: string;
  scoreUsed: number;
  slotType: SlotType;
};

export type TeamScoreCalculation = {
  detailLines: TeamScoreDetailLine[];
  maxSubstitutions: number;
  startersCount: number;
  substitutionsCount: number;
  totalScore: number;
  unusedBenchPlayerIds: string[];
  usedBenchPlayerIds: string[];
};
