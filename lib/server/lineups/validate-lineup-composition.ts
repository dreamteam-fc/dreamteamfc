import { PlayerRole } from "@prisma/client";

export type LineupCompositionPlayer = {
  id: string;
  role: PlayerRole;
};

export type LineupCompositionValidationResult = {
  attackerBenchCount: number;
  attackerStarterCount: number;
  benchCount: number;
  defenderBenchCount: number;
  defenderStarterCount: number;
  errors: string[];
  goalkeeperBenchCount: number;
  goalkeeperStarterCount: number;
  isValid: boolean;
  midfielderBenchCount: number;
  midfielderStarterCount: number;
  starterCount: number;
};

/** Formazione Dream Team: 5 titolari + 4 panchina (1 per ruolo) */
export const REQUIRED_STARTERS = 5;
export const REQUIRED_BENCH = 4;
export const REQUIRED_TOTAL_LINEUP_PLAYERS = 9;
export const REQUIRED_STARTER_GOALKEEPERS = 1;
export const MIN_STARTER_OUTFIELD_PER_ROLE = 1;
export const MAX_BENCH_ORDER = 4;

function countByRole(
  players: LineupCompositionPlayer[],
  role: PlayerRole
) {
  return players.filter((player) => player.role === role).length;
}

export function validateLineupComposition(
  starters: LineupCompositionPlayer[],
  bench: LineupCompositionPlayer[]
): LineupCompositionValidationResult {
  const starterCount = starters.length;
  const benchCount = bench.length;
  const goalkeeperStarterCount = countByRole(starters, PlayerRole.GOALKEEPER);
  const defenderStarterCount = countByRole(starters, PlayerRole.DEFENDER);
  const midfielderStarterCount = countByRole(starters, PlayerRole.MIDFIELDER);
  const attackerStarterCount = countByRole(starters, PlayerRole.ATTACKER);
  const goalkeeperBenchCount = countByRole(bench, PlayerRole.GOALKEEPER);
  const defenderBenchCount = countByRole(bench, PlayerRole.DEFENDER);
  const midfielderBenchCount = countByRole(bench, PlayerRole.MIDFIELDER);
  const attackerBenchCount = countByRole(bench, PlayerRole.ATTACKER);

  const errors: string[] = [];
  const uniquePlayerIds = new Set([...starters, ...bench].map((player) => player.id));

  if (starterCount !== REQUIRED_STARTERS) {
    errors.push(
      `La formazione deve avere esattamente ${REQUIRED_STARTERS} titolari. Totale attuale: ${starterCount}.`
    );
  }

  if (benchCount !== REQUIRED_BENCH) {
    errors.push(
      `La formazione deve avere esattamente ${REQUIRED_BENCH} panchinari (1 per ruolo). Totale attuale: ${benchCount}.`
    );
  }

  if (uniquePlayerIds.size !== REQUIRED_TOTAL_LINEUP_PLAYERS) {
    errors.push(
      `La formazione deve contenere ${REQUIRED_TOTAL_LINEUP_PLAYERS} giocatori unici tra titolari e panchina.`
    );
  }

  if (goalkeeperStarterCount !== REQUIRED_STARTER_GOALKEEPERS) {
    errors.push("I titolari devono avere esattamente 1 portiere.");
  }

  if (defenderStarterCount < MIN_STARTER_OUTFIELD_PER_ROLE) {
    errors.push("I titolari devono avere almeno 1 difensore.");
  }

  if (midfielderStarterCount < MIN_STARTER_OUTFIELD_PER_ROLE) {
    errors.push("I titolari devono avere almeno 1 centrocampista.");
  }

  if (attackerStarterCount < MIN_STARTER_OUTFIELD_PER_ROLE) {
    errors.push("I titolari devono avere almeno 1 attaccante.");
  }

  // 1P obbligatorio + 4 tra D/C/A con almeno 1 per ruolo → quinto slot libero D/C/A
  const outfieldStarterCount =
    defenderStarterCount + midfielderStarterCount + attackerStarterCount;
  if (
    starterCount === REQUIRED_STARTERS &&
    goalkeeperStarterCount === REQUIRED_STARTER_GOALKEEPERS &&
    outfieldStarterCount !== 4
  ) {
    errors.push(
      "I titolari devono avere 1 portiere e 4 giocatori di movimento (minimo 1D, 1C, 1A)."
    );
  }

  if (goalkeeperBenchCount !== 1) {
    errors.push("La panchina deve avere esattamente 1 portiere.");
  }

  if (defenderBenchCount !== 1) {
    errors.push("La panchina deve avere esattamente 1 difensore.");
  }

  if (midfielderBenchCount !== 1) {
    errors.push("La panchina deve avere esattamente 1 centrocampista.");
  }

  if (attackerBenchCount !== 1) {
    errors.push("La panchina deve avere esattamente 1 attaccante.");
  }

  return {
    attackerBenchCount,
    attackerStarterCount,
    benchCount,
    defenderBenchCount,
    defenderStarterCount,
    errors,
    goalkeeperBenchCount,
    goalkeeperStarterCount,
    isValid: errors.length === 0,
    midfielderBenchCount,
    midfielderStarterCount,
    starterCount
  };
}
