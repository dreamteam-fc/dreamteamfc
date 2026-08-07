import { redirect } from "next/navigation";

import {
  canAccessAdminArea,
  canAssignAppRoles,
  canManageLeagueOps,
  canManagePlatform,
  canManageVotes,
  isAppAdmin
} from "@/lib/auth/app-roles.ts";
import {
  buildLoginPath,
  getAuthenticatedAppUserContext,
  requireAuthenticatedAppUser,
  type AuthenticatedAppUserContext
} from "./app-user";

function denyAccess(): never {
  redirect(buildLoginPath({ error: "Accesso non autorizzato" }));
}

function requireAppUser(
  authContext: AuthenticatedAppUserContext
): asserts authContext is AuthenticatedAppUserContext & {
  appUser: NonNullable<AuthenticatedAppUserContext["appUser"]>;
} {
  if (!authContext.appUser) {
    denyAccess();
  }
}

/** Full platform admin only (God mode). */
export async function requireAdminAccess() {
  const authContext = await requireAuthenticatedAppUser("/admin");
  requireAppUser(authContext);

  if (!isAppAdmin(authContext.appUser.role)) {
    denyAccess();
  }

  return authContext;
}

/** Admin or Mister — may enter /admin for allowed capabilities. */
export async function requireStaffAccess() {
  const authContext = await requireAuthenticatedAppUser("/admin");
  requireAppUser(authContext);

  if (!canAccessAdminArea(authContext.appUser.role)) {
    denyAccess();
  }

  return authContext;
}

/** @deprecated Prefer requireStaffAccess — alias for Mister|Admin. */
export async function requireMisterOrAdminAccess() {
  return requireStaffAccess();
}

export async function assertCanManageVotes() {
  const authContext = await requireStaffAccess();

  if (!canManageVotes(authContext.appUser.role)) {
    denyAccess();
  }

  return authContext;
}

export async function assertCanManageLeagueOps() {
  const authContext = await requireStaffAccess();

  if (!canManageLeagueOps(authContext.appUser.role)) {
    denyAccess();
  }

  return authContext;
}

export async function assertCanManagePlatform() {
  return requireAdminAccess();
}

/**
 * Solo admin principale (PRIMARY_ADMIN_EMAIL / dreamteamfc@proton.me):
 * più stretto di canManagePlatform — gli ADMIN nominati sono esclusi.
 */
export async function assertCanAssignAppRoles() {
  const authContext = await requireAdminAccess();

  if (
    !canAssignAppRoles(authContext.appUser.role, authContext.appUser.email)
  ) {
    denyAccess();
  }

  return authContext;
}

/** Alias esplicito per page /admin/permessi. */
export async function requirePrimaryAdminAccess() {
  return assertCanAssignAppRoles();
}

export async function getAuthenticatedAdminContext() {
  const authContext = await getAuthenticatedAppUserContext();

  if (!authContext?.appUser || !canAccessAdminArea(authContext.appUser.role)) {
    return null;
  }

  return authContext;
}

export async function getAuthenticatedPlatformAdminContext() {
  const authContext = await getAuthenticatedAppUserContext();

  if (!authContext?.appUser || !canManagePlatform(authContext.appUser.role)) {
    return null;
  }

  return authContext;
}
