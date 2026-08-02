import { REQUIRED_ROSTER_SIZE } from "./validate-roster-composition.ts";

/**
 * Owner roster lock (durable product rule, count-based — no schema flag):
 * - Owner can edit (add/remove) iff roster player count < 25
 * - Owner cannot edit iff roster player count >= 25
 * - Platform Admin always can (subject to capacity / other validation)
 *
 * Entering a league = fill the roster until 25; once full, it is frozen for the owner.
 * Coach/Mister never edit rosters (enforced at role level in team-access / admin gates).
 */
export const OWNER_ROSTER_LOCK_SIZE = REQUIRED_ROSTER_SIZE;

export const OWNER_ROSTER_LOCKED_MESSAGE =
  "Rosa completa: solo l'amministratore può modificarla.";

export type RosterEditMode = "owner" | "admin";

export function canOwnerEditRoster(rosterPlayerCount: number): boolean {
  return rosterPlayerCount < OWNER_ROSTER_LOCK_SIZE;
}

export function isOwnerRosterLocked(rosterPlayerCount: number): boolean {
  return !canOwnerEditRoster(rosterPlayerCount);
}

export function assertCanEditTeamRoster(options: {
  mode: RosterEditMode;
  rosterPlayerCount: number;
}): void {
  if (options.mode === "admin") {
    return;
  }

  if (!canOwnerEditRoster(options.rosterPlayerCount)) {
    throw new Error(OWNER_ROSTER_LOCKED_MESSAGE);
  }
}
