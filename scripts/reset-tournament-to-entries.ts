/**
 * Wipe tournament bracket / runtime back to ENTRIES_SET.
 *
 * Keeps Tournament + TournamentTeamEntry (seeds / seedPoints / activation).
 * Deletes rounds, fixtures, lineups, votes, required votes; clears lineupsOpen.
 * Does not touch League / FantasyTeam data.
 *
 * Default resolve order:
 *   1. --tournamentId=
 *   2. preferred prior-cleanup id (cmsdpkoel01mdta014x5ypf1s) if still present
 *   3. name "prova" (or --name=)
 *   4. single active BRACKET_GENERATED / IN_PROGRESS tournament
 *
 * Usage:
 *   node --experimental-strip-types --experimental-default-type=module --experimental-specifier-resolution=node scripts/reset-tournament-to-entries.ts --confirm
 *   ... --confirm --tournamentId=<id>
 *   ... --confirm --name=prova
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma.ts";
import { resetTournamentToEntries } from "../lib/server/tournaments/reset-tournament-to-entries.ts";

const PREFERRED_TOURNAMENT_ID = "cmsdpkoel01mdta014x5ypf1s";

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

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const options: { tournamentId?: string; tournamentName?: string } = {};

  for (const arg of argv) {
    if (arg === "--confirm") {
      flags.add("confirm");
      continue;
    }

    if (arg.startsWith("--tournamentId=")) {
      options.tournamentId = arg.slice("--tournamentId=".length).trim() || undefined;
      continue;
    }

    if (arg.startsWith("--name=")) {
      options.tournamentName = arg.slice("--name=".length).trim() || undefined;
    }
  }

  return { flags, options };
}

async function main() {
  loadLocalEnvFile();

  const { flags, options } = parseArgs(process.argv.slice(2));

  if (!flags.has("confirm")) {
    console.warn("Reset non eseguito.");
    console.warn(
      "Cancella tabellone/runtime del torneo e riporta lo stato a ENTRIES_SET."
    );
    console.warn("Mantiene torneo + entries (seed/seedPoints). Non tocca leghe/squadre.");
    console.warn(
      "Per procedere: ... scripts/reset-tournament-to-entries.ts --confirm"
    );
    console.warn("Opzioni: --tournamentId=<id> --name=<nome>");
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL mancante nel .env");
  }

  const summary = await resetTournamentToEntries({
    preferredTournamentId: PREFERRED_TOURNAMENT_ID,
    tournamentId: options.tournamentId,
    tournamentName: options.tournamentName
  });

  console.log("Reset torneo -> ENTRIES_SET completato.");
  console.log(`Torneo: ${summary.tournamentName} (${summary.tournamentId})`);
  console.log(
    `Stato: ${summary.tournamentStatusBefore} -> ${summary.tournamentStatusAfter}`
  );
  console.log(
    `lineupsOpen: ${summary.lineupsOpenBefore} -> ${summary.lineupsOpenAfter}`
  );
  console.log(`Entries mantenute: ${summary.entryCountKept}`);
  console.log(`TournamentRound eliminati: ${summary.deletedRounds}`);
  console.log(`TournamentFixture eliminati: ${summary.deletedFixtures}`);
  console.log(`TournamentLineup eliminati: ${summary.deletedLineups}`);
  console.log(
    `TournamentLineupPlayer eliminati: ${summary.deletedLineupPlayers}`
  );
  console.log(`TournamentPlayerVote eliminati: ${summary.deletedPlayerVotes}`);
  console.log(
    `TournamentRequiredVotePlayer eliminati: ${summary.deletedRequiredVotes}`
  );
  console.log("League / FantasyTeam / roster lega: non toccati.");
}

main()
  .catch((error) => {
    console.error("Reset torneo -> ENTRIES_SET fallito:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
