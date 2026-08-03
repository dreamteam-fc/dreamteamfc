/**
 * Wipe tutte le leghe (e dati collegati) e crea 7 leghe di test, ciascuna con
 * 10 utenti Auth distinti + fantasy team + rosa completa (3P/8D/8C/6A).
 *
 * Uso (locale, .env caricato automaticamente):
 *   npm run db:seed-multi-test-leagues -- --confirm
 *
 * Credenziali:
 *   email utente:  test-l{lega}-u{n}@example.com  (lega 1..7, n 1..10)
 *   password:      Test1234!
 *   join lega N:   LegaTest{N}123!
 *
 * I giocatori reali possono ripetersi tra leghe diverse; dentro una lega
 * restano esclusivi. Catalogo Player e admin piattaforma non vengono cancellati.
 */
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  LeagueRole,
  LeagueStatus,
  PlayerRole,
  PrismaClient,
  UserRole
} from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hashSecret } from "../lib/server/security/secret-hash.ts";
import {
  REQUIRED_ROSTER_ATTACKERS,
  REQUIRED_ROSTER_DEFENDERS,
  REQUIRED_ROSTER_GOALKEEPERS,
  REQUIRED_ROSTER_MIDFIELDERS,
  REQUIRED_ROSTER_SIZE,
  validateRosterComposition
} from "../lib/server/rosters/validate-roster-composition.ts";

const LEAGUE_COUNT = 7;
const ACCOUNTS_PER_LEAGUE = 10;
const TEST_PASSWORD = "Test1234!";
const PREFERRED_ADMIN_EMAIL = "dreamteamfc@proton.me";

const ROLE_QUOTAS: Array<{ role: PlayerRole; count: number }> = [
  { role: PlayerRole.GOALKEEPER, count: REQUIRED_ROSTER_GOALKEEPERS },
  { role: PlayerRole.DEFENDER, count: REQUIRED_ROSTER_DEFENDERS },
  { role: PlayerRole.MIDFIELDER, count: REQUIRED_ROSTER_MIDFIELDERS },
  { role: PlayerRole.ATTACKER, count: REQUIRED_ROSTER_ATTACKERS }
];

type AuthUserRef = { id: string; email: string };
type AppUserRef = { id: string; email: string; authUserId: string | null };
type PlayerRef = { id: string; role: PlayerRole };
/** Loose client type: bare `ReturnType<typeof createClient>` is too narrow vs runtime clients. */
type ServiceRoleSupabase = SupabaseClient<any, "public", any>;

function createServiceRoleClient(
  url: string,
  serviceRoleKey: string
): ServiceRoleSupabase {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  let dbHost = "(missing DATABASE_URL)";
  if (databaseUrl) {
    try {
      dbHost = new URL(databaseUrl).hostname;
    } catch {
      dbHost = "(unparseable DATABASE_URL)";
    }
  }

  return {
    dbHost,
    supabaseUrl: supabaseUrl ?? "(missing NEXT_PUBLIC_SUPABASE_URL)"
  };
}

function leagueName(leagueIndex: number) {
  return `lega test ${leagueIndex}`;
}

function leagueJoinPassword(leagueIndex: number) {
  return `LegaTest${leagueIndex}123!`;
}

function testEmail(leagueIndex: number, userIndex: number) {
  return `test-l${leagueIndex}-u${userIndex}@example.com`;
}

function testDisplayName(leagueIndex: number, userIndex: number) {
  return `Test L${leagueIndex} U${userIndex}`;
}

function testTeamName(leagueIndex: number, userIndex: number) {
  return `Team L${leagueIndex} U${userIndex}`;
}

function hasConfirmationFlag() {
  return process.argv.slice(2).includes("--confirm");
}

function shuffleInPlace<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const current = items[i]!;
    items[i] = items[j]!;
    items[j] = current;
  }
  return items;
}

function takePlayers(
  pool: PlayerRef[],
  count: number,
  roleLabel: string
): PlayerRef[] {
  if (pool.length < count) {
    throw new Error(
      `Giocatori insufficienti per ruolo ${roleLabel}: servono ${count}, disponibili ${pool.length}.`
    );
  }

  return pool.splice(0, count);
}

function buildRandomRoster(pools: Map<PlayerRole, PlayerRef[]>): PlayerRef[] {
  const selected: PlayerRef[] = [];

  for (const quota of ROLE_QUOTAS) {
    const pool = pools.get(quota.role);
    if (!pool) {
      throw new Error(`Pool mancante per ruolo ${quota.role}.`);
    }

    selected.push(...takePlayers(pool, quota.count, quota.role));
  }

  const validation = validateRosterComposition(
    selected.map((player) => ({ role: player.role }))
  );

  if (!validation.isValid) {
    throw new Error(
      `Rosa generata non valida: ${validation.errors.join(" | ")}`
    );
  }

  return selected;
}

function buildFreshPools(activePlayers: PlayerRef[]): Map<PlayerRole, PlayerRef[]> {
  const pools = new Map<PlayerRole, PlayerRef[]>();
  for (const role of Object.values(PlayerRole)) {
    const rolePlayers = activePlayers.filter((player) => player.role === role);
    pools.set(role, shuffleInPlace([...rolePlayers]));
  }
  return pools;
}

async function findAuthUserByEmail(
  supabase: ServiceRoleSupabase,
  email: string
): Promise<AuthUserRef | null> {
  const normalized = email.toLowerCase();
  const perPage = 200;
  let page = 1;

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw new Error(`listUsers fallita: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find(
      (user) => user.email?.toLowerCase() === normalized
    );

    if (match?.email) {
      return { id: match.id, email: match.email };
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

async function ensureAuthUser(
  supabase: ServiceRoleSupabase,
  email: string,
  displayName: string
): Promise<AuthUserRef> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      full_name: displayName
    }
  });

  if (!error && data.user?.email) {
    return { id: data.user.id, email: data.user.email };
  }

  const alreadyExists =
    error?.message?.toLowerCase().includes("already") ||
    error?.message?.toLowerCase().includes("registered") ||
    error?.status === 422;

  if (!alreadyExists) {
    throw new Error(
      `Creazione Auth fallita per ${email}: ${error?.message ?? "errore sconosciuto"}`
    );
  }

  const existing = await findAuthUserByEmail(supabase, email);
  if (!existing) {
    throw new Error(
      `Utente Auth ${email} risulta già registrato ma non è stato trovato via listUsers.`
    );
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    existing.id,
    {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        full_name: displayName
      }
    }
  );

  if (updateError) {
    throw new Error(
      `Aggiornamento Auth fallito per ${email}: ${updateError.message}`
    );
  }

  return existing;
}

async function ensureAppUser(
  prisma: PrismaClient,
  options: {
    authUserId: string;
    displayName: string;
    email: string;
  }
): Promise<AppUserRef> {
  const existing = await prisma.user.findUnique({
    where: { email: options.email },
    select: {
      id: true,
      email: true,
      authUserId: true,
      displayName: true
    }
  });

  if (!existing) {
    return prisma.user.create({
      data: {
        authUserId: options.authUserId,
        displayName: options.displayName,
        email: options.email,
        role: UserRole.USER
      },
      select: {
        id: true,
        email: true,
        authUserId: true
      }
    });
  }

  if (existing.authUserId && existing.authUserId !== options.authUserId) {
    throw new Error(
      `Conflitto authUserId per ${options.email}: DB=${existing.authUserId}, Auth=${options.authUserId}`
    );
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      authUserId: options.authUserId,
      displayName: existing.displayName ?? options.displayName
    },
    select: {
      id: true,
      email: true,
      authUserId: true
    }
  });
}

async function resolveLeagueCreator(prisma: PrismaClient): Promise<{
  id: string;
  email: string;
}> {
  const preferred = await prisma.user.findFirst({
    where: {
      email: {
        equals: PREFERRED_ADMIN_EMAIL,
        mode: "insensitive"
      }
    },
    select: { id: true, email: true, role: true }
  });

  if (preferred) {
    if (preferred.role !== UserRole.ADMIN) {
      console.warn(
        `Attenzione: ${preferred.email} esiste ma non è ADMIN (role=${preferred.role}). Lo uso comunque come createdBy.`
      );
    }
    return { id: preferred.id, email: preferred.email };
  }

  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true }
  });

  if (admin) {
    console.warn(
      `${PREFERRED_ADMIN_EMAIL} non trovato: uso ADMIN ${admin.email} come createdBy.`
    );
    return admin;
  }

  throw new Error(
    `Nessun creatore lega disponibile: manca ${PREFERRED_ADMIN_EMAIL} e nessun User.role=ADMIN in DB.`
  );
}

async function main() {
  loadLocalEnvFile();

  if (!hasConfirmationFlag()) {
    console.warn("Seed multi-lega non eseguito.");
    console.warn(
      "Questo script CANCELLA tutte le leghe/tornei/dati collegati e crea 7 leghe di test."
    );
    console.warn("Catalogo Player e utenti Auth esistenti restano (admin incluso).");
    console.warn(
      "Per procedere esegui: npm run db:seed-multi-test-leagues -- --confirm"
    );
    return;
  }

  const target = describeDatabaseTarget();

  console.log("=== seed-multi-test-leagues ===");
  console.log(`DATABASE host: ${target.dbHost}`);
  console.log(`Supabase URL:  ${target.supabaseUrl}`);
  console.log(`Leagues:       ${LEAGUE_COUNT}`);
  console.log(`Users/league:  ${ACCOUNTS_PER_LEAGUE}`);
  console.log(`Total users:   ${LEAGUE_COUNT * ACCOUNTS_PER_LEAGUE}`);
  console.log("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante nel .env");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante nel .env");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL mancante nel .env");
  }

  const prisma = new PrismaClient();
  const supabase = createServiceRoleClient(supabaseUrl, serviceRoleKey);

  try {
    const activePlayers = await prisma.player.findMany({
      where: { isActive: true },
      select: { id: true, role: true }
    });

    if (activePlayers.length === 0) {
      throw new Error(
        "Tabella Player vuota (o nessun giocatore attivo). Importa i giocatori prima di eseguire questo seed."
      );
    }

    // Pool check is per-league (players may be reused across leagues).
    const requiredByRole = new Map<PlayerRole, number>([
      [PlayerRole.GOALKEEPER, REQUIRED_ROSTER_GOALKEEPERS * ACCOUNTS_PER_LEAGUE],
      [PlayerRole.DEFENDER, REQUIRED_ROSTER_DEFENDERS * ACCOUNTS_PER_LEAGUE],
      [PlayerRole.MIDFIELDER, REQUIRED_ROSTER_MIDFIELDERS * ACCOUNTS_PER_LEAGUE],
      [PlayerRole.ATTACKER, REQUIRED_ROSTER_ATTACKERS * ACCOUNTS_PER_LEAGUE]
    ]);

    for (const [role, required] of requiredByRole) {
      const available = activePlayers.filter((player) => player.role === role)
        .length;
      if (available < required) {
        throw new Error(
          `Giocatori attivi insufficienti per ${role}: servono ${required} (10 rose esclusive × quota in UNA lega), disponibili ${available}. Impossibile creare anche una sola lega completa.`
        );
      }
    }

    console.log(
      `Giocatori attivi: ${activePlayers.length} (minimo per 1 lega: ${REQUIRED_ROSTER_SIZE * ACCOUNTS_PER_LEAGUE})`
    );

    const creator = await resolveLeagueCreator(prisma);
    console.log(`createdBy: ${creator.email} (${creator.id})`);
    console.log("");

    console.log("Wipe leghe / tornei / dati collegati...");
    // Dynamic import AFTER loadLocalEnvFile so lib/prisma sees DATABASE_URL.
    const { resetLeagueData } = await import(
      "../lib/server/admin/reset-league-data.ts"
    );
    const wipeSummary = await resetLeagueData();
    console.log(
      `Wipe OK — leagues=${wipeSummary.leagueCount}, teams=${wipeSummary.fantasyTeamCount}, tournaments=${wipeSummary.tournamentCount}, rosters=${wipeSummary.rosterCount}, matchdays=${wipeSummary.matchdayCount}, lineups=${wipeSummary.lineupCount}`
    );
    console.log("");

    const remainingLeagues = await prisma.league.count();
    if (remainingLeagues !== 0) {
      throw new Error(
        `Wipe incompleto: restano ${remainingLeagues} leghe. Abort.`
      );
    }

    type LeagueResult = {
      id: string;
      name: string;
      joinPassword: string;
      accounts: Array<{
        email: string;
        password: string;
        teamName: string;
        rosterSize: number;
        role: LeagueRole;
      }>;
    };

    const leagueResults: LeagueResult[] = [];

    for (let leagueIndex = 1; leagueIndex <= LEAGUE_COUNT; leagueIndex += 1) {
      const name = leagueName(leagueIndex);
      const joinPassword = leagueJoinPassword(leagueIndex);

      console.log(`--- ${name} ---`);

      const appUsers: AppUserRef[] = [];

      for (let userIndex = 1; userIndex <= ACCOUNTS_PER_LEAGUE; userIndex += 1) {
        const email = testEmail(leagueIndex, userIndex);
        const displayName = testDisplayName(leagueIndex, userIndex);
        const authUser = await ensureAuthUser(supabase, email, displayName);
        const appUser = await ensureAppUser(prisma, {
          authUserId: authUser.id,
          displayName,
          email
        });
        appUsers.push(appUser);
      }

      console.log(
        `Auth+User OK: ${ACCOUNTS_PER_LEAGUE} account (${testEmail(leagueIndex, 1)} … ${testEmail(leagueIndex, ACCOUNTS_PER_LEAGUE)})`
      );

      const league = await prisma.league.create({
        data: {
          createdById: creator.id,
          maxAutoSubs: 4,
          maxTeams: ACCOUNTS_PER_LEAGUE,
          name,
          passwordHash: hashSecret(joinPassword),
          startersCount: 5,
          status: LeagueStatus.ACTIVE
        },
        select: { id: true, name: true }
      });

      const teams: Array<{ id: string; name: string; userId: string }> = [];
      const accountRows: LeagueResult["accounts"] = [];

      for (let index = 0; index < ACCOUNTS_PER_LEAGUE; index += 1) {
        const user = appUsers[index]!;
        const userIndex = index + 1;
        const teamName = testTeamName(leagueIndex, userIndex);
        const membershipRole =
          index === 0 ? LeagueRole.OWNER : LeagueRole.MEMBER;

        await prisma.leagueMember.create({
          data: {
            leagueId: league.id,
            userId: user.id,
            role: membershipRole
          }
        });

        const team = await prisma.fantasyTeam.create({
          data: {
            leagueId: league.id,
            userId: user.id,
            name: teamName
          },
          select: { id: true, name: true, userId: true }
        });

        teams.push(team);
        accountRows.push({
          email: user.email,
          password: TEST_PASSWORD,
          teamName: team.name,
          rosterSize: 0,
          role: membershipRole
        });
      }

      // Fresh shuffled pools per league — same real players may be reused across leagues.
      const pools = buildFreshPools(activePlayers);

      for (const team of teams) {
        const rosterPlayers = buildRandomRoster(pools);
        await prisma.fantasyRoster.createMany({
          data: rosterPlayers.map((player) => ({
            fantasyTeamId: team.id,
            leagueId: league.id,
            playerId: player.id
          }))
        });
      }

      for (let index = 0; index < ACCOUNTS_PER_LEAGUE; index += 1) {
        const team = teams[index]!;
        const rosterRoles = await prisma.fantasyRoster.findMany({
          where: { fantasyTeamId: team.id },
          select: { player: { select: { role: true } } }
        });

        const validation = validateRosterComposition(
          rosterRoles.map((entry) => ({ role: entry.player.role }))
        );

        if (!validation.isValid) {
          throw new Error(
            `Rosa non valida per ${team.name}: ${validation.errors.join(" | ")}`
          );
        }

        accountRows[index]!.rosterSize = rosterRoles.length;
      }

      leagueResults.push({
        id: league.id,
        name: league.name,
        joinPassword,
        accounts: accountRows
      });

      console.log(
        `Lega OK: ${league.name} (${league.id}) — ${teams.length} team, rose ${REQUIRED_ROSTER_SIZE}/${REQUIRED_ROSTER_SIZE}`
      );
      console.log("");
    }

    const totalUsers = leagueResults.reduce(
      (sum, league) => sum + league.accounts.length,
      0
    );
    const totalTeams = totalUsers;
    const totalRostersOk = leagueResults.every((league) =>
      league.accounts.every(
        (account) => account.rosterSize === REQUIRED_ROSTER_SIZE
      )
    );

    const emails = leagueResults.flatMap((league) =>
      league.accounts.map((account) => account.email.toLowerCase())
    );
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      throw new Error(
        `Email non uniche: attese ${emails.length}, uniche ${uniqueEmails.size}.`
      );
    }

    console.log("=== RISULTATO ===");
    console.log(
      `Wipe precedente: leagues=${wipeSummary.leagueCount}, teams=${wipeSummary.fantasyTeamCount}, tournaments=${wipeSummary.tournamentCount}, rosters=${wipeSummary.rosterCount}`
    );
    console.log(`Utenti creati/aggiornati: ${totalUsers} (tutti email uniche)`);
    console.log(`Fantasy team: ${totalTeams}`);
    console.log(
      `Rose complete: ${totalRostersOk ? `sì (${REQUIRED_ROSTER_SIZE}/${REQUIRED_ROSTER_SIZE})` : "NO — verificare"}`
    );
    console.log(`Password login utenti: ${TEST_PASSWORD}`);
    console.log(`createdBy leghe: ${creator.email}`);
    console.log("");

    for (const league of leagueResults) {
      console.log(
        `${league.name} | id=${league.id} | join=${league.joinPassword}`
      );
      for (const account of league.accounts) {
        console.log(
          `  ${account.email} | ${account.password} | ${account.teamName} | ${account.rosterSize}/${REQUIRED_ROSTER_SIZE} | ${account.role}`
        );
      }
      console.log("");
    }

    console.log("Pattern email: test-l{lega}-u{n}@example.com");
    console.log("Pattern join:  LegaTest{lega}123!");
  } finally {
    await prisma.$disconnect();
    try {
      const { prisma: sharedPrisma } = await import("../lib/prisma.ts");
      await sharedPrisma.$disconnect();
    } catch {
      // Shared client may not have been imported if we aborted before wipe.
    }
  }
}

main().catch((error) => {
  console.error("seed-multi-test-leagues FALLITO:", error);
  process.exitCode = 1;
});
