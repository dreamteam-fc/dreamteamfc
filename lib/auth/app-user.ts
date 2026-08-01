import { UserRole, type User } from "@prisma/client";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma.ts";
import { createSupabaseServerClient } from "@/lib/supabase/server.ts";

type AppUserRecord = Pick<
  User,
  "authUserId" | "displayName" | "email" | "id" | "role"
>;

export type AuthenticatedAppUserContext = {
  appUser: AppUserRecord | null;
  authUser: SupabaseAuthUser;
  error?: string;
};

function capitalizeWord(word: string) {
  if (word.length === 0) {
    return word;
  }

  return `${word[0]?.toUpperCase() ?? ""}${word.slice(1).toLowerCase()}`;
}

function sanitizeDisplayName(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const normalized = localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ")
    .trim();

  return normalized.length > 0 ? normalized : email;
}

export function getSafeNextPath(
  value: string | null | undefined,
  fallback = "/me"
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function buildLoginPath(options?: {
  error?: string;
  next?: string;
  notice?: string;
}) {
  const searchParams = new URLSearchParams();

  if (options?.error) {
    searchParams.set("error", options.error);
  }

  if (options?.notice) {
    searchParams.set("notice", options.notice);
  }

  if (options?.next) {
    searchParams.set("next", getSafeNextPath(options.next));
  }

  const search = searchParams.toString();
  return search.length > 0 ? `/login?${search}` : "/login";
}

function buildAuthPath(
  pathname: string,
  options?: {
    error?: string;
    next?: string;
    notice?: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (options?.error) {
    searchParams.set("error", options.error);
  }

  if (options?.notice) {
    searchParams.set("notice", options.notice);
  }

  if (options?.next) {
    searchParams.set("next", getSafeNextPath(options.next));
  }

  const search = searchParams.toString();
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

export function buildSignupPath(options?: {
  error?: string;
  next?: string;
  notice?: string;
}) {
  return buildAuthPath("/signup", options);
}

export function buildForgotPasswordPath(options?: {
  error?: string;
  next?: string;
  notice?: string;
}) {
  return buildAuthPath("/forgot-password", options);
}

export function buildResetPasswordPath(options?: {
  error?: string;
  next?: string;
  notice?: string;
}) {
  return buildAuthPath("/reset-password", options);
}

export async function findAppUserByAuthUserId(authUserId: string) {
  return prisma.user.findUnique({
    where: {
      authUserId
    },
    select: {
      authUserId: true,
      displayName: true,
      email: true,
      id: true,
      role: true
    }
  });
}

export function deriveDisplayNameFromAuthUser(user: SupabaseAuthUser) {
  const metadata = user.user_metadata ?? {};

  return (
    sanitizeDisplayName(metadata.full_name) ??
    sanitizeDisplayName(metadata.display_name) ??
    sanitizeDisplayName(metadata.name) ??
    sanitizeDisplayName(metadata.user_name) ??
    sanitizeDisplayName(metadata.preferred_username) ??
    (user.email ? deriveDisplayNameFromEmail(user.email) : null)
  );
}

function getBootstrapAdminEmail() {
  const raw = process.env.ADMIN_EMAIL?.trim();
  return raw && raw.length > 0 ? raw.toLowerCase() : null;
}

function shouldBootstrapAsAdmin(email: string) {
  const bootstrapEmail = getBootstrapAdminEmail();
  return bootstrapEmail !== null && email.toLowerCase() === bootstrapEmail;
}

const appUserSelect = {
  authUserId: true,
  displayName: true,
  email: true,
  id: true,
  role: true
} as const;

/**
 * Safe bootstrap: if ADMIN_EMAIL matches AND no Admin exists yet (or all
 * Admins were removed), promote this user to ADMIN.
 * Otherwise User.role in DB is the source of truth (assignments from /admin stick).
 */
async function ensureBootstrapAdminRole(
  appUser: AppUserRecord
): Promise<AppUserRecord> {
  if (
    appUser.role === UserRole.ADMIN ||
    !shouldBootstrapAsAdmin(appUser.email)
  ) {
    return appUser;
  }

  const adminCount = await prisma.user.count({
    where: { role: UserRole.ADMIN }
  });

  if (adminCount > 0) {
    return appUser;
  }

  return prisma.user.update({
    where: { id: appUser.id },
    data: { role: UserRole.ADMIN },
    select: appUserSelect
  });
}

export async function ensureAppUserForAuthUser(user: SupabaseAuthUser) {
  const existingByAuthUserId = await findAppUserByAuthUserId(user.id);
  if (existingByAuthUserId) {
    return ensureBootstrapAdminRole(existingByAuthUserId);
  }

  if (!user.email) {
    throw new Error(
      "Impossibile creare l'utente applicativo: email mancante in Supabase Auth."
    );
  }

  const displayName = deriveDisplayNameFromAuthUser(user);
  const existingByEmail = await prisma.user.findUnique({
    where: {
      email: user.email
    },
    select: appUserSelect
  });

  if (existingByEmail) {
    if (existingByEmail.authUserId === user.id) {
      return ensureBootstrapAdminRole(existingByEmail);
    }

    if (existingByEmail.authUserId) {
      throw new Error("Questo account email e gia collegato a un altro utente.");
    }

    // ADMIN rows without authUserId need an explicit link script, unless this
    // login is ADMIN_EMAIL and there are no other linked admins (lockout escape).
    if (existingByEmail.role === UserRole.ADMIN) {
      const canBootstrapLink =
        shouldBootstrapAsAdmin(user.email) &&
        (await prisma.user.count({
          where: {
            role: UserRole.ADMIN,
            authUserId: { not: null }
          }
        })) === 0;

      if (!canBootstrapLink) {
        throw new Error(
          "Questo account richiede un collegamento admin esplicito prima dell'accesso."
        );
      }
    }

    const linked = await prisma.user.update({
      where: {
        id: existingByEmail.id
      },
      data: {
        authUserId: user.id,
        displayName: existingByEmail.displayName ?? displayName
      },
      select: appUserSelect
    });

    return ensureBootstrapAdminRole(linked);
  }

  const created = await prisma.user.create({
    data: {
      authUserId: user.id,
      displayName,
      email: user.email,
      role: UserRole.USER
    },
    select: appUserSelect
  });

  return ensureBootstrapAdminRole(created);
}

export async function getAuthenticatedAppUserContext(): Promise<AuthenticatedAppUserContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  try {
    const appUser = await ensureAppUserForAuthUser(user);

    return {
      appUser,
      authUser: user
    };
  } catch (caughtError) {
    return {
      appUser: null,
      authUser: user,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Impossibile caricare l'utente applicativo."
    };
  }
}

export async function requireAuthenticatedAppUser(nextPath = "/me") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(buildLoginPath({ next: nextPath }));
  }

  try {
    const appUser = await ensureAppUserForAuthUser(user);

    return {
      appUser,
      authUser: user
    };
  } catch (caughtError) {
    await supabase.auth.signOut();
    redirect(
      buildLoginPath({
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Impossibile collegare l'utente applicativo.",
        next: nextPath
      })
    );
  }
}
