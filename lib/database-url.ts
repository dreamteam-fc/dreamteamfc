/**
 * Normalize Postgres URLs for Prisma + Supabase poolers.
 *
 * Transaction pooler (:6543) must include `pgbouncer=true` so Prisma disables
 * prepared statements (avoids Postgres 42P05 "prepared statement already exists"
 * when PgBouncer/Supavisor is in transaction mode).
 *
 * Also caps `connection_limit` when omitted (Railway / Supabase Free).
 * Preserves existing query params (sslmode, etc.).
 *
 * Do NOT apply pgbouncer=true to DIRECT_URL / Session :5432 used for migrate.
 */

export type NormalizeDatabaseUrlOptions = {
  /** Default 1 — one Prisma engine socket per process toward the pooler. */
  connectionLimit?: number;
  /**
   * When true (default), append pgbouncer=true if the URL targets transaction
   * pooler port 6543 and the flag is missing.
   */
  ensurePgbouncer?: boolean;
};

function isTruthyPgbouncer(value: string | null): boolean {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Supabase (and similar) transaction poolers listen on 6543. */
export function isTransactionPoolerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.port === "6543";
  } catch {
    return /:(6543)(?:\/|[?&#]|$)/.test(url);
  }
}

/**
 * Runtime DATABASE_URL normalizer for PrismaClient datasources override.
 * Safe no-op for unparseable URLs (returns input unchanged).
 */
export function normalizeRuntimeDatabaseUrl(
  url: string | undefined,
  options: NormalizeDatabaseUrlOptions = {}
): string | undefined {
  if (!url) return url;

  const connectionLimit = options.connectionLimit ?? 1;
  const ensurePgbouncer = options.ensurePgbouncer ?? true;

  try {
    const u = new URL(url);
    let appendedPgbouncer = false;

    if (ensurePgbouncer && u.port === "6543" && !isTruthyPgbouncer(u.searchParams.get("pgbouncer"))) {
      u.searchParams.set("pgbouncer", "true");
      appendedPgbouncer = true;
    }

    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", String(connectionLimit));
    }

    if (appendedPgbouncer && process.env.NODE_ENV !== "test") {
      // Redact credentials — log host/path/query only.
      const safe = `${u.protocol}//${u.host}${u.pathname}?${u.searchParams.toString()}`;
      console.warn(
        `[database-url] Appended pgbouncer=true for Transaction pooler :6543 (avoids 42P05). Prefer setting it on Railway DATABASE_URL. Effective: ${safe}`
      );
    }

    return u.toString();
  } catch {
    return url;
  }
}
