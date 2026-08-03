/**
 * Seed riusabile: formazioni casuali valide per Team Test 2–10 nella lega "lega test".
 *
 * Usa lo stesso helper server dell'admin (`generateRandomLineupsForMatchday`).
 * Non modifica mai la formazione di Team Test 1.
 *
 * Uso:
 *   npm run db:seed-test-lineups
 *   npm run db:seed-test-lineups -- --force   # riscrive anche formazioni già presenti
 *
 * Sicurezza: tocca solo la lega "lega test" e i team "Team Test N" (escluso Team Test 1).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { generateRandomLineupsForMatchday } from "../lib/server/lineups/generate-random-lineups-for-matchday.ts";

const LEAGUE_NAME = "lega test";
const TEAM_NAME_PREFIX = "Team Test";
const REFERENCE_TEAM_NAME = "Team Test 1";
const TARGET_MATCHDAY_NUMBER = 1;

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

function describeDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { dbHost: "(DATABASE_URL mancante)" };
  }

  try {
    return { dbHost: new URL(databaseUrl).host };
  } catch {
    return { dbHost: "(DATABASE_URL non valida)" };
  }
}

async function main() {
  loadLocalEnvFile();

  const force = process.argv.includes("--force");
  const target = describeDatabaseTarget();

  console.log("=== seed-test-lineups ===");
  console.log(`DATABASE host: ${target.dbHost}`);
  console.log(`League name:   ${LEAGUE_NAME}`);
  console.log(`Matchday:      ${TARGET_MATCHDAY_NUMBER}`);
  console.log(`Force rewrite: ${force ? "yes" : "no"}`);
  console.log("");

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL mancante nel .env");
  }

  const prisma = new PrismaClient();

  try {
    const league = await prisma.league.findFirst({
      where: { name: LEAGUE_NAME },
      select: { id: true, name: true }
    });

    if (!league) {
      throw new Error(
        `Lega "${LEAGUE_NAME}" non trovata. Esegui prima npm run db:seed-test-league.`
      );
    }

    const matchday = await prisma.matchday.findUnique({
      where: {
        leagueId_number: {
          leagueId: league.id,
          number: TARGET_MATCHDAY_NUMBER
        }
      },
      select: { id: true, number: true, status: true }
    });

    if (!matchday) {
      throw new Error(
        `Giornata ${TARGET_MATCHDAY_NUMBER} non trovata per "${LEAGUE_NAME}".`
      );
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: {
        leagueId: league.id,
        name: { startsWith: TEAM_NAME_PREFIX }
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    });

    const referenceTeam = teams.find(
      (team) => team.name === REFERENCE_TEAM_NAME
    );
    if (!referenceTeam) {
      throw new Error(
        `Squadra di riferimento "${REFERENCE_TEAM_NAME}" non trovata.`
      );
    }

    const targetTeams = teams
      .filter((team) => team.name !== REFERENCE_TEAM_NAME)
      .sort((left, right) => {
        const leftNumber = Number(left.name.replace(TEAM_NAME_PREFIX, "").trim());
        const rightNumber = Number(
          right.name.replace(TEAM_NAME_PREFIX, "").trim()
        );
        return leftNumber - rightNumber;
      });

    if (targetTeams.length === 0) {
      throw new Error("Nessuna squadra target (Team Test 2–10) trovata.");
    }

    console.log(
      `Target: ${targetTeams.length} squadre | giornata ${matchday.number} (${matchday.status})`
    );
    console.log(`Riferimento non toccato: ${REFERENCE_TEAM_NAME}`);
    console.log("");

    const result = await generateRandomLineupsForMatchday({
      db: prisma,
      force,
      fantasyTeamIds: targetTeams.map((team) => team.id),
      leagueId: league.id,
      matchdayId: matchday.id
    });

    for (const failure of result.failures) {
      console.error(`FAIL  ${failure.teamName}: ${failure.error}`);
    }

    console.log("");
    console.log(
      `Fatto. Scritte: ${result.written} | Saltate: ${result.skipped} | Fallite: ${result.failures.length}`
    );
    console.log(
      `Matchday: giornata ${matchday.number} (${matchday.id}) | Lega: ${league.name}`
    );

    if (result.failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("seed-test-lineups FALLITO:", error);
  process.exitCode = 1;
});
