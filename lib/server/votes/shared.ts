import { Prisma, RequiredVoteStatus } from "@prisma/client";

import { calculateFantavote } from "../../scoring/calculate-fantavote.ts";
import type { FantavoteInput } from "../../scoring/types.ts";

export type SavePlayerVoteInput = {
  assists?: number;
  baseVote: number | null;
  cleanSheet?: number;
  goals?: number;
  goalsConceded?: number;
  isSv: boolean;
  matchdayId: string;
  notes?: string | null;
  ownGoals?: number;
  penaltiesMissed?: number;
  penaltiesSaved?: number;
  /** RF: tracciamento only; non entra nel fantavoto. */
  penaltiesScored?: number;
  playerId: string;
  redCards?: number;
  yellowCards?: number;
};

export type ValidatedPlayerVoteInput = FantavoteInput & {
  assists: number;
  cleanSheet: number;
  goals: number;
  goalsConceded: number;
  matchdayId: string;
  notes: string | null;
  ownGoals: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
  penaltiesScored: number;
  playerId: string;
  redCards: number;
  yellowCards: number;
};

export const COMPLETED_REQUIRED_VOTE_STATUSES = [
  RequiredVoteStatus.COMPLETED,
  RequiredVoteStatus.SV,
  RequiredVoteStatus.IGNORED
] as const;

export function isRequiredVoteCompletedStatus(
  status: RequiredVoteStatus
): boolean {
  return (
    status === RequiredVoteStatus.COMPLETED ||
    status === RequiredVoteStatus.SV ||
    status === RequiredVoteStatus.IGNORED
  );
}

export function deriveRequiredVoteStatusFromStoredVote(vote?: {
  isSv: boolean;
} | null): RequiredVoteStatus {
  if (!vote) {
    return RequiredVoteStatus.PENDING;
  }

  return vote.isSv
    ? RequiredVoteStatus.SV
    : RequiredVoteStatus.COMPLETED;
}

function assertNonNegativeInteger(fieldName: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be an integer greater than or equal to 0.`);
  }
}

export function validatePlayerVoteInput(
  input: SavePlayerVoteInput
): ValidatedPlayerVoteInput {
  const validated: ValidatedPlayerVoteInput = {
    assists: input.assists ?? 0,
    baseVote: input.baseVote,
    cleanSheet: input.cleanSheet ?? 0,
    goals: input.goals ?? 0,
    goalsConceded: input.goalsConceded ?? 0,
    isSv: input.isSv,
    matchdayId: input.matchdayId,
    notes: input.notes ?? null,
    ownGoals: input.ownGoals ?? 0,
    penaltiesMissed: input.penaltiesMissed ?? 0,
    penaltiesSaved: input.penaltiesSaved ?? 0,
    penaltiesScored: input.penaltiesScored ?? 0,
    playerId: input.playerId,
    redCards: input.redCards ?? 0,
    yellowCards: input.yellowCards ?? 0
  };

  assertNonNegativeInteger("goals", validated.goals);
  assertNonNegativeInteger("goalsConceded", validated.goalsConceded);
  assertNonNegativeInteger("assists", validated.assists);
  assertNonNegativeInteger("yellowCards", validated.yellowCards);
  assertNonNegativeInteger("redCards", validated.redCards);
  assertNonNegativeInteger("ownGoals", validated.ownGoals);
  assertNonNegativeInteger("penaltiesMissed", validated.penaltiesMissed);
  assertNonNegativeInteger("penaltiesSaved", validated.penaltiesSaved);
  assertNonNegativeInteger("penaltiesScored", validated.penaltiesScored);
  assertNonNegativeInteger("cleanSheet", validated.cleanSheet);

  if (validated.isSv) {
    if (validated.baseVote !== null) {
      throw new Error("baseVote must be null when isSv is true.");
    }

    return validated;
  }

  if (validated.baseVote === null) {
    throw new Error("baseVote is required when isSv is false.");
  }

  if (!Number.isFinite(validated.baseVote)) {
    throw new Error("baseVote must be a finite number.");
  }

  if (validated.baseVote < 0 || validated.baseVote > 10) {
    throw new Error("baseVote must be between 0 and 10.");
  }

  return validated;
}

export function calculatePersistedFantavote(
  input: ValidatedPlayerVoteInput
): {
  finalFantavote: Prisma.Decimal | null;
  requiredVoteStatus: RequiredVoteStatus;
} {
  const calculation = calculateFantavote(input);

  return {
    finalFantavote:
      calculation.finalFantavote === null
        ? null
        : new Prisma.Decimal(calculation.finalFantavote),
    requiredVoteStatus: calculation.isSv
      ? RequiredVoteStatus.SV
      : RequiredVoteStatus.COMPLETED
  };
}

export function prismaDecimalToNumber(
  value: Prisma.Decimal | number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}
