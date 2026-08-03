import {
  ALLOWED_BRACKET_SIZES_LABEL,
  isAllowedBracketSize
} from "@/lib/tournaments/bracket-size.ts";

export type SeedCandidate = {
  entryId: string;
  fantasyTeamId: string;
  leagueId: string;
  name: string;
  seedPoints: number;
};

export type SeededTeam = SeedCandidate & {
  seedRank: number;
};

export type BracketPair = {
  away: SeededTeam;
  bracketSlot: number;
  home: SeededTeam;
};

export type RoundPlan = {
  bracketSlots: number;
  isFinal: boolean;
  name: string;
  roundIndex: number;
  twoLegs: boolean;
};

export function rankSeedCandidates(candidates: SeedCandidate[]): SeededTeam[] {
  const sorted = [...candidates].sort((left, right) => {
    if (right.seedPoints !== left.seedPoints) {
      return right.seedPoints - left.seedPoints;
    }

    return left.name.localeCompare(right.name, "it");
  });

  return sorted.map((entry, index) => ({
    ...entry,
    seedRank: index + 1
  }));
}

function roundNameForTeamsInRound(teamsInRound: number): string {
  switch (teamsInRound) {
    case 2:
      return "Finale";
    case 4:
      return "Semifinali";
    case 8:
      return "Quarti di finale";
    case 16:
      return "Ottavi di finale";
    case 32:
      return "Sedicesimi di finale";
    case 64:
      return "Trentaduesimi di finale";
    default:
      return `Round of ${teamsInRound}`;
  }
}

export function buildRoundPlans(teamCount: number): RoundPlan[] {
  if (!isAllowedBracketSize(teamCount)) {
    throw new Error(
      `Il tabellone richiede ${ALLOWED_BRACKET_SIZES_LABEL} squadre.`
    );
  }

  const roundCount = Math.log2(teamCount);
  const plans: RoundPlan[] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const teamsInRound = teamCount / 2 ** roundIndex;
    const isFinal = teamsInRound === 2;

    plans.push({
      bracketSlots: teamsInRound / 2,
      isFinal,
      name: roundNameForTeamsInRound(teamsInRound),
      roundIndex,
      twoLegs: !isFinal
    });
  }

  return plans;
}

function classicHighLowPairs(seeded: SeededTeam[]): BracketPair[] {
  const pairs: BracketPair[] = [];
  const n = seeded.length;

  for (let slot = 0; slot < n / 2; slot += 1) {
    pairs.push({
      away: seeded[n - 1 - slot],
      bracketSlot: slot,
      home: seeded[slot]
    });
  }

  return pairs;
}

function countSameLeagueConflicts(pairs: BracketPair[]): number {
  return pairs.filter((pair) => pair.home.leagueId === pair.away.leagueId).length;
}

/**
 * Alto vs basso, poi ripara conflitti stessa-lega in 1ª fase scambiando gli away
 * tra slot finché possibile (dimensioni ammesse: 4–64).
 */
export function pairFirstRoundAvoidingSameLeague(
  seeded: SeededTeam[]
): BracketPair[] {
  if (!isAllowedBracketSize(seeded.length)) {
    throw new Error(
      `Seeding richiede ${ALLOWED_BRACKET_SIZES_LABEL} squadre.`
    );
  }

  let pairs = classicHighLowPairs(seeded);
  const maxAttempts = Math.max(64, seeded.length * 4);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const conflictIndex = pairs.findIndex(
      (pair) => pair.home.leagueId === pair.away.leagueId
    );

    if (conflictIndex === -1) {
      return pairs.map((pair, bracketSlot) => ({ ...pair, bracketSlot }));
    }

    let improved = false;
    const before = countSameLeagueConflicts(pairs);

    for (let other = 0; other < pairs.length; other += 1) {
      if (other === conflictIndex) {
        continue;
      }

      const next = pairs.map((pair) => ({ ...pair }));
      const swapAway = next[conflictIndex].away;
      next[conflictIndex] = {
        ...next[conflictIndex],
        away: next[other].away
      };
      next[other] = {
        ...next[other],
        away: swapAway
      };

      const after = countSameLeagueConflicts(next);
      if (after < before) {
        pairs = next;
        improved = true;
        break;
      }
    }

    if (!improved) {
      break;
    }
  }

  if (countSameLeagueConflicts(pairs) > 0) {
    throw new Error(
      "Impossibile accoppiare la 1ª fase senza scontri stessa lega. Cambia le squadre selezionate."
    );
  }

  return pairs.map((pair, bracketSlot) => ({ ...pair, bracketSlot }));
}
