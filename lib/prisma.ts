import { PrismaClient } from "@prisma/client";

import { normalizeRuntimeDatabaseUrl } from "./database-url.ts";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

/**
 * Runtime URL: pgbouncer=true on :6543; connection_limit defaults to 5 on
 * long-running hosts (Railway) and 1 on serverless — see lib/database-url.ts.
 *
 * Prefer avoiding long interactive `$transaction` on poolers. Calendar
 * generation writes with plain createMany (no interactive tx). For short
 * sticky multi-step writes that still need interactive tx, see
 * withSessionPrisma in lib/prisma-session.ts (DIRECT_URL / Session :5432).
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
