/**
 * One-shot / reusable: clear calculated results for a tournament phase.
 *
 * Default: most recent BRACKET_GENERATED / IN_PROGRESS tournament, first round
 * (lowest roundIndex with fixtures). Deletes votes for that round, resets
 * fixture goals/status, and undoes bracket advancement into later rounds.
 * Keeps lineups and per-leg lineupsStatus.
 *
 * Usage:
 *   node --experimental-strip-types --experimental-default-type=module --experimental-specifier-resolution=node scripts/reset-tournament-round-results.ts --confirm
 *   ... --confirm --tournamentId=<id>
 *   ... --confirm --roundId=<id>
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma.ts";
import { resetTournamentRoundResults } from "../lib/server/tournaments/reset-tournament-round-results.ts";

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
  const options: { roundId?: string; tournamentId?: string } = {};

  for (const arg of argv) {
    if (arg === "--confirm") {
      flags.add("confirm");
      continue;
    }

    if (arg.startsWith("--tournamentId=")) {
      options.tournamentId = arg.slice("--tournamentId=".length).trim() || undefined;
      continue;
    }

    if (arg.startsWith("--roundId=")) {
      options.roundId = arg.slice("--roundId=".length).trim() || undefined;
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
      "Cancella risultati/voti della fase (default: prima fase del torneo attivo) e annulla avanzamenti."
    );
    console.warn(
      "Per procedere: ... scripts/reset-tournament-round-results.ts --confirm"
    );
    console.warn(
      "Opzioni: --tournamentId=<id> --roundId=<id>"
    );
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL mancante nel .env");
  }

  const summary = await resetTournamentRoundResults(options);

  console.log("Reset risultati fase torneo completato.");
  console.log(
    `Torneo: ${summary.tournamentName} (${summary.tournamentId})`
  );
  console.log(
    `Fase: ${summary.roundName} (roundIndex=${summary.roundIndex}, ${summary.roundId})`
  );
  console.log(`Fixture risultati azzerati: ${summary.resetFixtureResults}`);
  console.log(`TournamentPlayerVote eliminati: ${summary.deletedPlayerVotes}`);
  console.log(
    `TournamentRequiredVotePlayer eliminati: ${summary.deletedRequiredVotes}`
  );
  console.log(
    `Slot squadre fase successiva azzerati: ${summary.clearedNextRoundTeamSlots}`
  );
  console.log(`Fasi successive ripulite: ${summary.subsequentRoundsCleared}`);
  console.log(
    `Stato torneo: ${summary.tournamentStatusBefore} -> ${summary.tournamentStatusAfter}`
  );
  console.log("Lineup e lineupsStatus per gamba lasciati invariati.");
}

main()
  .catch((error) => {
    console.error("Reset risultati fase torneo fallito:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
