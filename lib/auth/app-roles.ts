import { UserRole } from "@prisma/client";

/**
 * Platform/app roles on User.role (not LeagueRole OWNER/MEMBER).
 *
 * Mister allow: Fantacalcio XLS vote import (league), required/bulk votes,
 * matchdays, schedule, open/lock lineups, score calculation, related paths.
 *
 * Mister deny (default when unsure): create leagues/tournaments, tournament
 * ops, assign roles, global player deactivate/block, admin roster CRUD,
 * reset league data, coach-invite admin, anything "platform God mode".
 */

export const ASSIGNABLE_APP_ROLES = [
  UserRole.USER,
  UserRole.MISTER,
  UserRole.ADMIN
] as const;

export type AssignableAppRole = (typeof ASSIGNABLE_APP_ROLES)[number];

/**
 * Admin principale: solo questo account può `/admin/permessi` e assegnare ruoli.
 * Override opzionale: PRIMARY_ADMIN_EMAIL. Default prodotto: dreamteamfc@proton.me.
 */
export const DEFAULT_PRIMARY_ADMIN_EMAIL = "dreamteamfc@proton.me";

export function getPrimaryAdminEmail(): string {
  const raw = process.env.PRIMARY_ADMIN_EMAIL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_PRIMARY_ADMIN_EMAIL).toLowerCase();
}

/** Case-insensitive match against the primary-admin allowlist (one email). */
export function isPrimaryAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === getPrimaryAdminEmail();
}

export function isAppAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function isMisterOrAdmin(role: UserRole): boolean {
  return role === UserRole.MISTER || role === UserRole.ADMIN;
}

/** Layout /admin: Admin and Mister may enter the area. */
export function canAccessAdminArea(role: UserRole): boolean {
  return isMisterOrAdmin(role);
}

/** Calendar, matchdays, lineups open/lock, scores, fantasy fixtures. */
export function canManageLeagueOps(role: UserRole): boolean {
  return isMisterOrAdmin(role);
}

/** League Fantacalcio XLS import, save/bulk votes, generate required votes. */
export function canManageVotes(role: UserRole): boolean {
  return isMisterOrAdmin(role);
}

/**
 * Platform God mode: leagues, tournaments, global players, roster admin,
 * resets. Role assignment is stricter — see canAssignAppRoles.
 */
export function canManagePlatform(role: UserRole): boolean {
  return isAppAdmin(role);
}

/**
 * Assegnazione ruoli piattaforma: solo admin principale (email allowlist),
 * non ogni User.role=ADMIN nominato.
 */
export function canAssignAppRoles(role: UserRole, email: string): boolean {
  return isAppAdmin(role) && isPrimaryAdminEmail(email);
}

export function parseAppRole(value: string): UserRole | null {
  if (
    value === UserRole.USER ||
    value === UserRole.MISTER ||
    value === UserRole.ADMIN
  ) {
    return value;
  }

  return null;
}

export function appRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "Admin";
    case UserRole.MISTER:
      return "Mister";
    default:
      return "Utente";
  }
}
