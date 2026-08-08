import { calculateFantavote } from "@/lib/scoring/calculate-fantavote.ts";
import type { FantavoteInput } from "@/lib/scoring/types.ts";

export type FantavoteBreakdownVote = FantavoteInput;

export type FantavoteBreakdown = {
  baseVote: number | null;
  bonusParts: string[];
  bonusPoints: number;
  finalFantavote: number | null;
  isSv: boolean;
  malusParts: string[];
  malusPoints: number;
  /** Compact label e.g. "6 +3 Gf −0,5 Amm = 8,5" or "SV". */
  summary: string;
};

function formatSigned(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(".", ",");
  return rounded > 0 ? `+${text}` : text;
}

function formatPlain(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(".", ",");
}

/**
 * Human-readable bonus/malus breakdown from the same rules as calculateFantavote.
 */
export function describeFantavoteBreakdown(
  vote: FantavoteBreakdownVote | null | undefined
): FantavoteBreakdown {
  if (!vote || vote.isSv) {
    return {
      baseVote: null,
      bonusParts: [],
      bonusPoints: 0,
      finalFantavote: null,
      isSv: true,
      malusParts: [],
      malusPoints: 0,
      summary: "SV"
    };
  }

  if (vote.baseVote === null) {
    return {
      baseVote: null,
      bonusParts: [],
      bonusPoints: 0,
      finalFantavote: null,
      isSv: false,
      malusParts: [],
      malusPoints: 0,
      summary: "-"
    };
  }

  const calc = calculateFantavote(vote);
  const goals = vote.goals ?? 0;
  const penaltiesScored = vote.penaltiesScored ?? 0;
  const assists = vote.assists ?? 0;
  const penaltiesSaved = vote.penaltiesSaved ?? 0;
  const cleanSheet = vote.cleanSheet ?? 0;
  const yellowCards = vote.yellowCards ?? 0;
  const redCards = vote.redCards ?? 0;
  const ownGoals = vote.ownGoals ?? 0;
  const penaltiesMissed = vote.penaltiesMissed ?? 0;
  const goalsConceded = vote.goalsConceded ?? 0;

  const bonusParts: string[] = [];
  if (goals > 0) bonusParts.push(`${formatSigned(goals * 3)} Gf`);
  if (penaltiesScored > 0) {
    bonusParts.push(`${formatSigned(penaltiesScored * 3)} Rf`);
  }
  if (assists > 0) bonusParts.push(`${formatSigned(assists)} Ass`);
  if (penaltiesSaved > 0) {
    bonusParts.push(`${formatSigned(penaltiesSaved * 3)} Rp`);
  }
  if (cleanSheet > 0) bonusParts.push(`${formatSigned(cleanSheet)} CS`);

  const malusParts: string[] = [];
  if (yellowCards > 0) {
    malusParts.push(`${formatSigned(-(yellowCards * 0.5))} Amm`);
  }
  if (redCards > 0) malusParts.push(`${formatSigned(-redCards)} Esp`);
  if (ownGoals > 0) malusParts.push(`${formatSigned(-(ownGoals * 2))} Au`);
  if (penaltiesMissed > 0) {
    malusParts.push(`${formatSigned(-(penaltiesMissed * 3))} Rs`);
  }
  if (goalsConceded > 0) {
    malusParts.push(`${formatSigned(-goalsConceded)} Gs`);
  }

  const parts = [
    formatPlain(vote.baseVote),
    ...bonusParts,
    ...malusParts,
    `= ${formatPlain(calc.finalFantavote)}`
  ];

  return {
    baseVote: vote.baseVote,
    bonusParts,
    bonusPoints: calc.bonusPoints,
    finalFantavote: calc.finalFantavote,
    isSv: false,
    malusParts,
    malusPoints: calc.malusPoints,
    summary: parts.join(" ")
  };
}
