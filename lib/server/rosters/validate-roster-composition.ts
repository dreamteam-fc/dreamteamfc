import { PlayerRole } from "@prisma/client";

export type RosterCompositionPlayer = {
  isBlockedInLeague?: boolean;
  isGloballyInactive?: boolean;
  role: PlayerRole;
};

export type RosterCompositionValidationResult = {
  attackerCount: number;
  blockedCount: number;
  defenderCount: number;
  errors: string[];
  goalkeeperCount: number;
  isComplete: boolean;
  isValid: boolean;
  midfielderCount: number;
  total: number;
};

/** Rosa Dream Team: 3P + 8D + 8C + 6A = 25 */
export const REQUIRED_ROSTER_SIZE = 25;
export const REQUIRED_ROSTER_GOALKEEPERS = 3;
export const REQUIRED_ROSTER_DEFENDERS = 8;
export const REQUIRED_ROSTER_MIDFIELDERS = 8;
export const REQUIRED_ROSTER_ATTACKERS = 6;

export function validateRosterComposition(
  players: RosterCompositionPlayer[]
): RosterCompositionValidationResult {
  const total = players.length;
  const goalkeeperCount = players.filter(
    (player) => player.role === PlayerRole.GOALKEEPER
  ).length;
  const defenderCount = players.filter(
    (player) => player.role === PlayerRole.DEFENDER
  ).length;
  const midfielderCount = players.filter(
    (player) => player.role === PlayerRole.MIDFIELDER
  ).length;
  const attackerCount = players.filter(
    (player) => player.role === PlayerRole.ATTACKER
  ).length;
  const blockedCount = players.filter((player) => player.isBlockedInLeague).length;
  const globallyInactiveCount = players.filter(
    (player) => player.isGloballyInactive
  ).length;
  const unavailableCount = blockedCount + globallyInactiveCount;

  const errors: string[] = [];
  const isComplete = total === REQUIRED_ROSTER_SIZE;

  if (!isComplete) {
    errors.push(
      `La rosa deve avere esattamente ${REQUIRED_ROSTER_SIZE} giocatori (3P, 8D, 8C, 6A). Totale attuale: ${total}.`
    );
  }

  if (goalkeeperCount !== REQUIRED_ROSTER_GOALKEEPERS) {
    errors.push(
      `La rosa deve avere esattamente ${REQUIRED_ROSTER_GOALKEEPERS} portieri. Attuali: ${goalkeeperCount}.`
    );
  }

  if (defenderCount !== REQUIRED_ROSTER_DEFENDERS) {
    errors.push(
      `La rosa deve avere esattamente ${REQUIRED_ROSTER_DEFENDERS} difensori. Attuali: ${defenderCount}.`
    );
  }

  if (midfielderCount !== REQUIRED_ROSTER_MIDFIELDERS) {
    errors.push(
      `La rosa deve avere esattamente ${REQUIRED_ROSTER_MIDFIELDERS} centrocampisti. Attuali: ${midfielderCount}.`
    );
  }

  if (attackerCount !== REQUIRED_ROSTER_ATTACKERS) {
    errors.push(
      `La rosa deve avere esattamente ${REQUIRED_ROSTER_ATTACKERS} attaccanti. Attuali: ${attackerCount}.`
    );
  }

  if (unavailableCount > 0) {
    errors.push("La rosa contiene giocatori non disponibili.");
  }

  return {
    attackerCount,
    blockedCount,
    defenderCount,
    errors,
    goalkeeperCount,
    isComplete,
    isValid: isComplete && errors.length === 0,
    midfielderCount,
    total
  };
}
