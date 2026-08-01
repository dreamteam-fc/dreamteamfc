import type { FantavoteCalculation, FantavoteInput } from "./types.ts";

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFantavote(
  input: FantavoteInput
): FantavoteCalculation {
  if (input.isSv) {
    return {
      ...input,
      bonusPoints: 0,
      finalFantavote: null,
      hasValidFantavote: false,
      malusPoints: 0
    };
  }

  if (input.baseVote === null) {
    throw new Error("baseVote is required when isSv is false.");
  }

  const goals = input.goals ?? 0;
  const assists = input.assists ?? 0;
  const penaltiesSaved = input.penaltiesSaved ?? 0;
  const cleanSheet = input.cleanSheet ?? 0;
  const yellowCards = input.yellowCards ?? 0;
  const redCards = input.redCards ?? 0;
  const ownGoals = input.ownGoals ?? 0;
  const penaltiesMissed = input.penaltiesMissed ?? 0;
  // gs: applicare solo ai portieri in fase di salvataggio voto; qui conta il valore già filtrato.
  const goalsConceded = input.goalsConceded ?? 0;

  const bonusPoints = roundToTwoDecimals(
    goals * 3 + assists * 1 + penaltiesSaved * 3 + cleanSheet * 1
  );
  const malusPoints = roundToTwoDecimals(
    yellowCards * 0.5 +
      redCards * 1 +
      ownGoals * 2 +
      penaltiesMissed * 3 +
      goalsConceded * 1
  );
  const finalFantavote = roundToTwoDecimals(
    input.baseVote + bonusPoints - malusPoints
  );

  return {
    ...input,
    bonusPoints,
    finalFantavote,
    hasValidFantavote: true,
    malusPoints
  };
}
