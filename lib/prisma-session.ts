import { PrismaClient } from "@prisma/client";

import {
  isTransactionPoolerUrl,
  resolveSessionDatabaseUrl,
  runtimeRequiresSessionPrisma
} from "./database-url.ts";
import { prisma } from "./prisma.ts";

/**
 * Run work on a Prisma client that supports sticky interactive `$transaction`.
 *
 * When DATABASE_URL is Supabase Transaction pooler (:6543 + pgbouncer),
 * interactive transactions often fail with:
 *   "Transaction not found. Transaction ID is invalid..."
 * because PgBouncer transaction mode does not pin the connection across
 * statements inside `prisma.$transaction(async (tx) => ...)`.
 *
 * In that case we open a short-lived client on DIRECT_URL (Session :5432),
 * run the callback, then disconnect so Session pool slots stay free for
 * migrate / other brief session work.
 *
 * When DATABASE_URL is already session-compatible, reuses the shared runtime
 * client (no extra connections).
 */
export async function withSessionPrisma<T>(
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  if (!runtimeRequiresSessionPrisma()) {
    return fn(prisma);
  }

  const sessionUrl = resolveSessionDatabaseUrl();
  if (!sessionUrl) {
    throw new Error(
      "DIRECT_URL (Session pooler :5432) is required for this operation when DATABASE_URL uses the Transaction pooler (:6543). Interactive transactions are not reliable over PgBouncer transaction mode."
    );
  }

  if (isTransactionPoolerUrl(sessionUrl)) {
    throw new Error(
      "DIRECT_URL points to Transaction pooler (:6543). Set DIRECT_URL to Session pooler :5432 for interactive transactions (calendar generation, multi-step writes)."
    );
  }

  const sessionPrisma = new PrismaClient({
    datasources: {
      db: {
        url: sessionUrl
      }
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

  try {
    return await fn(sessionPrisma);
  } finally {
    await sessionPrisma.$disconnect();
  }
}
