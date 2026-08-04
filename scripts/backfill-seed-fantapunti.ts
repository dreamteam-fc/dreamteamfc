/**
 * Best-effort backfill of TournamentTeamEntry.seedFantapunti from current standings.
 *
 * Usage:
 *   node --experimental-strip-types --experimental-default-type=module --experimental-specifier-resolution=node scripts/backfill-seed-fantapunti.ts
 *   ... --tournamentId=<id>
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma.ts";
import { backfillTournamentEntrySeedFantapunti } from "../lib/server/tournaments/backfill-seed-fantapunti.ts";

function loadLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function parseTournamentId(argv: string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith("--tournamentId=")) {
      return arg.slice("--tournamentId=".length).trim() || undefined;
    }
  }
  return undefined;
}

async function main() {
  loadLocalEnvFile();
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL mancante nel .env");
  }

  const tournamentId = parseTournamentId(process.argv.slice(2));
  const result = await backfillTournamentEntrySeedFantapunti({ tournamentId });
  console.log(
    `Backfill seedFantapunti: updated=${result.updated} skipped=${result.skipped}`
  );
}

main()
  .catch((error) => {
    console.error("Backfill seedFantapunti fallito:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
