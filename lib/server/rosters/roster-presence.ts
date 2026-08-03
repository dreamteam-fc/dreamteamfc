import { REQUIRED_ROSTER_SIZE } from "./validate-roster-composition.ts";

/** Full fantasy league size for admin lineup workflows. */
export const FULL_LEAGUE_TEAM_COUNT = 10;

export type RosterPresenceStatus = "ASSENTE" | "INCOMPLETA" | "COMPLETA";

/**
 * Admin-facing roster presence from player count vs required 25.
 * - ASSENTE: no players
 * - INCOMPLETA: some players but below 25
 * - COMPLETA: exactly 25 (rosa inserita / locked for owner)
 */
export function getRosterPresenceStatus(
  playerCount: number
): RosterPresenceStatus {
  if (playerCount <= 0) {
    return "ASSENTE";
  }

  if (playerCount < REQUIRED_ROSTER_SIZE) {
    return "INCOMPLETA";
  }

  return "COMPLETA";
}

export function isRosterInserted(playerCount: number): boolean {
  return playerCount >= REQUIRED_ROSTER_SIZE;
}

export function getRosterPresenceLabel(status: RosterPresenceStatus): string {
  switch (status) {
    case "ASSENTE":
      return "Rosa assente";
    case "INCOMPLETA":
      return "Rosa incompleta";
    case "COMPLETA":
      return "Rosa completa";
  }
}

export function getRosterPresenceBadgeClass(
  status: RosterPresenceStatus
): string {
  switch (status) {
    case "ASSENTE":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "INCOMPLETA":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "COMPLETA":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

/**
 * League eligible for the admin "Apri formazioni" hub:
 * exactly 10 enrolled teams and every team has a complete (25) roster.
 */
export function isLeagueEligibleForLineupsHub(options: {
  teamCount: number;
  teamsWithCompleteRoster: number;
}): boolean {
  return (
    options.teamCount === FULL_LEAGUE_TEAM_COUNT &&
    options.teamsWithCompleteRoster === FULL_LEAGUE_TEAM_COUNT
  );
}
