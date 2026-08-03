/**
 * Seed riusabile: formazioni giornata 1 per Team Test 2–10 nella lega "lega test".
 *
 * Copia la struttura (conteggi per ruolo titolari/panchina) dalla formazione
 * già salvata di Team Test 1, scegliendo giocatori dalla rosa di ogni squadra
 * in modo deterministico (ordine nome, poi id).
 *
 * Uso:
 *   npm run db:seed-test-lineups
 *   npm run db:seed-test-lineups -- --force   # riscrive anche formazioni già presenti (non Team Test 1)
 *
 * Sicurezza: tocca solo la lega "lega test" e i team "Team Test N".
 * Non modifica mai la formazione di Team Test 1.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  LineupStatus,
  PlayerRole,
  PrismaClient,
  SlotType
} from "@prisma/client";

import { getBenchPositionOrderByRole } from "../lib/lineups/bench-position-order.ts";
import { validateLineupComposition } from "../lib/server/lineups/validate-lineup-composition.ts";

const LEAGUE_NAME = "lega test";
const TEAM_NAME_PREFIX = "Team Test";
const REFERENCE_TEAM_NAME = "Team Test 1";
const TARGET_MATCHDAY_NUMBER = 1;

type RoleCounts = Record<PlayerRole, number>;

type RosterPlayer = {
  id: string;
  name: string;
  role: PlayerRole;
  isActive: boolean;
};

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

function emptyRoleCounts(): RoleCounts {
  return {
    [PlayerRole.GOALKEEPER]: 0,
    [PlayerRole.DEFENDER]: 0,
    [PlayerRole.MIDFIELDER]: 0,
    [PlayerRole.ATTACKER]: 0
  };
}

function countRoles(
  players: Array<{ role: PlayerRole }>
): RoleCounts {
  const counts = emptyRoleCounts();
  for (const player of players) {
    counts[player.role] += 1;
  }
  return counts;
}

function formatRoleCounts(counts: RoleCounts): string {
  return `P${counts.GOALKEEPER} D${counts.DEFENDER} C${counts.MIDFIELDER} A${counts.ATTACKER}`;
}

function sortRosterPlayers(left: RosterPlayer, right: RosterPlayer): number {
  const byName = left.name.localeCompare(right.name, "it");
  if (byName !== 0) {
    return byName;
  }
  return left.id.localeCompare(right.id);
}

function pickByRoleCounts(
  roster: RosterPlayer[],
  counts: RoleCounts,
  usedPlayerIds: Set<string>
): RosterPlayer[] {
  const picked: RosterPlayer[] = [];

  for (const role of [
    PlayerRole.GOALKEEPER,
    PlayerRole.DEFENDER,
    PlayerRole.MIDFIELDER,
    PlayerRole.ATTACKER
  ] as const) {
    const needed = counts[role];
    if (needed <= 0) {
      continue;
    }

    const available = roster
      .filter(
        (player) =>
          player.role === role &&
          player.isActive &&
          !usedPlayerIds.has(player.id)
      )
      .sort(sortRosterPlayers);

    if (available.length < needed) {
      throw new Error(
        `Rosa insufficiente per ruolo ${role}: servono ${needed}, disponibili ${available.length}.`
      );
    }

    for (let index = 0; index < needed; index += 1) {
      const player = available[index]!;
      picked.push(player);
      usedPlayerIds.add(player.id);
    }
  }

  return picked;
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
      select: {
        id: true,
        name: true,
        roster: {
          select: {
            player: {
              select: {
                id: true,
                name: true,
                role: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    const referenceTeam = teams.find(
      (team) => team.name === REFERENCE_TEAM_NAME
    );
    if (!referenceTeam) {
      throw new Error(`Squadra di riferimento "${REFERENCE_TEAM_NAME}" non trovata.`);
    }

    const referenceLineup = await prisma.lineup.findUnique({
      where: {
        fantasyTeamId_matchdayId: {
          fantasyTeamId: referenceTeam.id,
          matchdayId: matchday.id
        }
      },
      include: {
        players: {
          include: {
            player: {
              select: { id: true, name: true, role: true }
            }
          },
          orderBy: [{ slotType: "asc" }, { positionOrder: "asc" }]
        }
      }
    });

    if (!referenceLineup || referenceLineup.players.length === 0) {
      throw new Error(
        `"${REFERENCE_TEAM_NAME}" non ha una formazione sulla giornata ${matchday.number}. Salvala prima dall'UI.`
      );
    }

    const referenceStarters = referenceLineup.players
      .filter((entry) => entry.slotType === SlotType.STARTER)
      .sort((left, right) => left.positionOrder - right.positionOrder)
      .map((entry) => entry.player);
    const referenceBench = referenceLineup.players
      .filter((entry) => entry.slotType === SlotType.BENCH)
      .map((entry) => entry.player);

    const starterCounts = countRoles(referenceStarters);
    const benchCounts = countRoles(referenceBench);

    const referenceValidation = validateLineupComposition(
      referenceStarters,
      referenceBench
    );
    if (!referenceValidation.isValid) {
      throw new Error(
        `Formazione di riferimento non valida: ${referenceValidation.errors[0] ?? "errore sconosciuto"}`
      );
    }

    console.log(
      `Riferimento: ${REFERENCE_TEAM_NAME} | giornata ${matchday.number} (${matchday.status})`
    );
    console.log(
      `Struttura titolari: ${formatRoleCounts(starterCounts)} | panchina: ${formatRoleCounts(benchCounts)}`
    );
    console.log(
      `Titolari ref: ${referenceStarters.map((player) => `${player.role} ${player.name}`).join(", ")}`
    );
    console.log("");

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

    let written = 0;
    let skipped = 0;
    const failures: Array<{ team: string; error: string }> = [];

    for (const team of targetTeams) {
      try {
        const existing = await prisma.lineup.findUnique({
          where: {
            fantasyTeamId_matchdayId: {
              fantasyTeamId: team.id,
              matchdayId: matchday.id
            }
          },
          select: {
            id: true,
            status: true,
            _count: { select: { players: true } }
          }
        });

        if (
          !force &&
          existing &&
          existing.status === LineupStatus.SUBMITTED &&
          existing._count.players === 9
        ) {
          console.log(`SKIP  ${team.name}: formazione già presente (${existing._count.players} giocatori)`);
          skipped += 1;
          continue;
        }

        const roster: RosterPlayer[] = team.roster.map((entry) => entry.player);
        const usedPlayerIds = new Set<string>();
        const starters = pickByRoleCounts(roster, starterCounts, usedPlayerIds);
        const bench = pickByRoleCounts(roster, benchCounts, usedPlayerIds);

        // Mantieni ordine titolari come nel riferimento: P, poi D, C, A (stesso ordine ruoli)
        const startersOrdered = [
          ...starters.filter((player) => player.role === PlayerRole.GOALKEEPER),
          ...starters.filter((player) => player.role === PlayerRole.DEFENDER),
          ...starters.filter((player) => player.role === PlayerRole.MIDFIELDER),
          ...starters.filter((player) => player.role === PlayerRole.ATTACKER)
        ];

        const validation = validateLineupComposition(startersOrdered, bench);
        if (!validation.isValid) {
          throw new Error(validation.errors[0] ?? "Formazione non valida.");
        }

        await prisma.$transaction(async (tx) => {
          const lineup = existing
            ? await tx.lineup.update({
                where: { id: existing.id },
                data: {
                  status: LineupStatus.SUBMITTED,
                  submittedAt: new Date()
                },
                select: { id: true }
              })
            : await tx.lineup.create({
                data: {
                  fantasyTeamId: team.id,
                  matchdayId: matchday.id,
                  status: LineupStatus.SUBMITTED,
                  submittedAt: new Date()
                },
                select: { id: true }
              });

          await tx.lineupPlayer.deleteMany({
            where: { lineupId: lineup.id }
          });

          await tx.lineupPlayer.createMany({
            data: [
              ...startersOrdered.map((player, index) => ({
                lineupId: lineup.id,
                playerId: player.id,
                positionOrder: index + 1,
                slotType: SlotType.STARTER
              })),
              ...bench.map((player) => ({
                lineupId: lineup.id,
                playerId: player.id,
                positionOrder: getBenchPositionOrderByRole(player.role),
                slotType: SlotType.BENCH
              }))
            ]
          });
        });

        console.log(
          `OK    ${team.name}: ${formatRoleCounts(countRoles(startersOrdered))} + bench ${formatRoleCounts(countRoles(bench))}`
        );
        written += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Errore sconosciuto";
        console.error(`FAIL  ${team.name}: ${message}`);
        failures.push({ team: team.name, error: message });
      }
    }

    console.log("");
    console.log(
      `Fatto. Scritte: ${written} | Saltate: ${skipped} | Fallite: ${failures.length}`
    );
    console.log(
      `Matchday: giornata ${matchday.number} (${matchday.id}) | Lega: ${league.name}`
    );

    if (failures.length > 0) {
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
