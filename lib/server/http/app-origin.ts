import { headers } from "next/headers";

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return null;
  }
}

function getConfiguredAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!configured) {
    return null;
  }

  return normalizeOrigin(configured);
}

async function getRequestOrigin(): Promise<string | null> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (!host) {
    return null;
  }

  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  return normalizeOrigin(`${protocol}://${host}`);
}

/**
 * Resolves the public site origin for absolute links (invite URLs, auth redirects).
 * Order: NEXT_PUBLIC_APP_URL / APP_URL → request headers (Railway/proxies) → VERCEL_URL.
 */
export async function getAppOrigin(): Promise<string> {
  const configured = getConfiguredAppOrigin();
  if (configured) {
    return configured;
  }

  const fromRequest = await getRequestOrigin();
  if (fromRequest) {
    return fromRequest;
  }

  const vercelOrigin = process.env.VERCEL_URL
    ? normalizeOrigin(process.env.VERCEL_URL)
    : null;
  if (vercelOrigin) {
    return vercelOrigin;
  }

  throw new Error("Origine pubblica dell'app non disponibile.");
}

export async function buildAbsoluteAppUrl(pathname: string): Promise<string> {
  return new URL(pathname, await getAppOrigin()).toString();
}

export function buildTeamCoachInvitePath(token: string): string {
  return `/me/coach-invites/${token}`;
}

export async function buildTeamCoachInviteUrl(token: string): Promise<string> {
  return buildAbsoluteAppUrl(buildTeamCoachInvitePath(token));
}
