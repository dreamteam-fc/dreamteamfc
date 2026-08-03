/**
 * Normalize Postgres URLs for Prisma + Supabase poolers.
 *
 * Transaction pooler (:6543) must include `pgbouncer=true` so Prisma disables
 * prepared statements (avoids Postgres 42P05 "prepared statement already exists"
 * when PgBouncer/Supavisor is in transaction mode).
 *
 * connection_limit:
 * - Serverless (Vercel/Lambda/…): default 1 — many short-lived instances.
 * - Long-running (Railway/single Node): default 5 — concurrent server actions
 *   need more than one Prisma connection (interactive $transaction holds one).
 * - Override with options.connectionLimit or env PRISMA_CONNECTION_LIMIT.
 * - On long-running hosts, an explicit connection_limit=1 (legacy docs) is
 *   raised to the default so overlapping requests do not starve.
 *
 * Preserves existing query params (sslmode, etc.).
 * Do NOT apply pgbouncer=true to DIRECT_URL / Session :5432 used for migrate
 * or for interactive `$transaction` work (see normalizeSessionDatabaseUrl /
 * withSessionPrisma).
 */

export type NormalizeDatabaseUrlOptions = {
  /** When set, used as the target connection_limit (see module docs). */
  connectionLimit?: number;
  /**
   * When true (default), append pgbouncer=true if the URL targets transaction
   * pooler port 6543 and the flag is missing.
   */
  ensurePgbouncer?: boolean;
  /** Injectable env for tests; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
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
 * True when the process is a short-lived serverless isolate where a single
 * Prisma connection per instance is the right default.
 */
export function isServerlessRuntime(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    env.VERCEL === "1" ||
    typeof env.AWS_LAMBDA_FUNCTION_NAME === "string" ||
    env.NETLIFY === "true" ||
    typeof env.FUNCTIONS_WORKER_RUNTIME === "string" ||
    env.CF_PAGES === "1"
  );
}

/**
 * Default Prisma connection_limit for this runtime.
 * PRISMA_CONNECTION_LIMIT wins when it is a positive integer.
 */
export function defaultRuntimeConnectionLimit(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.PRISMA_CONNECTION_LIMIT?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return isServerlessRuntime(env) ? 1 : 5;
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

  const env = options.env ?? process.env;
  const connectionLimit =
    options.connectionLimit ?? defaultRuntimeConnectionLimit(env);
  const ensurePgbouncer = options.ensurePgbouncer ?? true;
  const serverless = isServerlessRuntime(env);

  try {
    const u = new URL(url);
    let appendedPgbouncer = false;
    let adjustedConnectionLimit = false;

    if (
      ensurePgbouncer &&
      u.port === "6543" &&
      !isTruthyPgbouncer(u.searchParams.get("pgbouncer"))
    ) {
      u.searchParams.set("pgbouncer", "true");
      appendedPgbouncer = true;
    }

    const existingLimit = u.searchParams.get("connection_limit");
    if (!existingLimit) {
      u.searchParams.set("connection_limit", String(connectionLimit));
      adjustedConnectionLimit = true;
    } else if (
      !serverless &&
      existingLimit === "1" &&
      connectionLimit > 1
    ) {
      // Legacy Railway docs recommended connection_limit=1; that starves
      // concurrent interactive transactions on a single always-on process.
      u.searchParams.set("connection_limit", String(connectionLimit));
      adjustedConnectionLimit = true;
    }

    if (process.env.NODE_ENV !== "test") {
      if (appendedPgbouncer) {
        const safe = `${u.protocol}//${u.host}${u.pathname}?${u.searchParams.toString()}`;
        console.warn(
          `[database-url] Appended pgbouncer=true for Transaction pooler :6543 (avoids 42P05). Prefer setting it on Railway DATABASE_URL. Effective: ${safe}`
        );
      }
      if (adjustedConnectionLimit && existingLimit === "1") {
        console.warn(
          `[database-url] Raised connection_limit from 1 to ${connectionLimit} for long-running runtime (avoids transaction start timeouts under concurrent requests). Set PRISMA_CONNECTION_LIMIT or connection_limit explicitly to override.`
        );
      }
    }

    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Normalize DIRECT_URL / Session pooler URLs for brief interactive-tx work.
 * Never appends pgbouncer=true. Forces a small connection_limit so Session
 * pool slots (~15 on Supabase Free) are not held by the app runtime.
 */
export function normalizeSessionDatabaseUrl(
  url: string | undefined,
  options: { connectionLimit?: number } = {}
): string | undefined {
  if (!url) return url;

  const connectionLimit = options.connectionLimit ?? 1;

  try {
    const u = new URL(url);
    u.searchParams.set("connection_limit", String(connectionLimit));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * True when DATABASE_URL is Supabase transaction pooler (:6543), where
 * Prisma interactive `$transaction` is unreliable (non-sticky connections →
 * "Transaction not found").
 */
export function runtimeRequiresSessionPrisma(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const databaseUrl = env.DATABASE_URL?.trim();
  return Boolean(databaseUrl && isTransactionPoolerUrl(databaseUrl));
}

/**
 * Resolve a Session-mode URL for interactive transactions.
 * Prefers DIRECT_URL; falls back to DATABASE_URL only when it is not :6543.
 */
export function resolveSessionDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const direct = env.DIRECT_URL?.trim();
  if (direct) {
    return normalizeSessionDatabaseUrl(direct);
  }

  const database = env.DATABASE_URL?.trim();
  if (database && !isTransactionPoolerUrl(database)) {
    return normalizeSessionDatabaseUrl(database);
  }

  return undefined;
}
