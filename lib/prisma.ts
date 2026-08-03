import { PrismaClient } from "@prisma/client";

import { normalizeRuntimeDatabaseUrl } from "./database-url.ts";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

/**
 * Runtime URL: pgbouncer=true on :6543; connection_limit defaults to 5 on
 * long-running hosts (Railway) and 1 on serverless — see lib/database-url.ts.
 *
 * For interactive `$transaction` that must stay sticky across statements
 * (calendar generation, multi-step writes), use withSessionPrisma from
 * lib/prisma-session.ts (DIRECT_URL / Session :5432) — Transaction pooler
 * drops those mid-flight with "Transaction not found".
 */
const datasourceUrl = normalizeRuntimeDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
