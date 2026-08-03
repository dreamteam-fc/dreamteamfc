/**
 * Seed riusabile: lega di test "lega test" con 10 account + 10 rose complete (3P/8D/8C/6A).
 *
 * Uso (locale, .env caricato automaticamente):
 *   npm run db:seed-test-league
 *   npm run db:seed-test-league -- --rebuild-rosters
 *
 * NON elimina leghe/utenti esistenti fuori da questa lega.
 * Gli account test sono pensati per login locale/dev su questo progetto Supabase.
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

const LEAGUE_NAME = "lega test";
const LEAGUE_JOIN_PASSWORD = "LegaTest123!";
const TEST_PASSWORD = "Test1234!";
const ACCOUNT_COUNT = 10;
const TEAM_NAME_PREFIX = "Team Test";

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

function testEmail(index: number) {
  return `test${index}@example.com`;
}

function testDisplayName(index: number) {
  return `Test User ${index}`;
}

function testTeamName(index: number) {
  return `${TEAM_NAME_PREFIX} ${index}`;
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

async function main() {
  loadLocalEnvFile();

  const rebuildRosters = process.argv.includes("--rebuild-rosters");
  const target = describeDatabaseTarget();

  console.log("=== seed-test-league ===");
  console.log(`DATABASE host: ${target.dbHost}`);
  console.log(`Supabase URL:  ${target.supabaseUrl}`);
  console.log(`League name:   ${LEAGUE_NAME}`);
  console.log(`Accounts:      ${ACCOUNT_COUNT}`);
  console.log(`Rebuild rosters: ${rebuildRosters ? "yes" : "no"}`);
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

    const requiredByRole = new Map<PlayerRole, number>([
      [PlayerRole.GOALKEEPER, REQUIRED_ROSTER_GOALKEEPERS * ACCOUNT_COUNT],
      [PlayerRole.DEFENDER, REQUIRED_ROSTER_DEFENDERS * ACCOUNT_COUNT],
      [PlayerRole.MIDFIELDER, REQUIRED_ROSTER_MIDFIELDERS * ACCOUNT_COUNT],
      [PlayerRole.ATTACKER, REQUIRED_ROSTER_ATTACKERS * ACCOUNT_COUNT]
    ]);

    for (const [role, required] of requiredByRole) {
      const available = activePlayers.filter((player) => player.role === role)
        .length;
      if (available < required) {
        throw new Error(
          `Giocatori attivi insufficienti per ${role}: servono ${required} (10 rose × quota), disponibili ${available}.`
        );
      }
    }

    console.log(
      `Giocatori attivi: ${activePlayers.length} (minimo richiesto: ${REQUIRED_ROSTER_SIZE * ACCOUNT_COUNT})`
    );

    const createdAccounts: Array<{
      email: string;
      password: string;
      appUserId: string;
      authUserId: string;
      teamName: string;
      rosterSize: number;
    }> = [];

    const appUsers: AppUserRef[] = [];

    for (let index = 1; index <= ACCOUNT_COUNT; index += 1) {
      const email = testEmail(index);
      const displayName = testDisplayName(index);
      const authUser = await ensureAuthUser(supabase, email, displayName);
      const appUser = await ensureAppUser(prisma, {
        authUserId: authUser.id,
        displayName,
        email
      });
      appUsers.push(appUser);
      console.log(`Auth+User OK: ${email} (auth=${authUser.id})`);
    }

    let creator = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true }
    });

    if (!creator) {
      creator = {
        id: appUsers[0]!.id,
        email: appUsers[0]!.email
      };
      console.log(
        `Nessun ADMIN in DB: createdBy = primo account test (${creator.email}).`
      );
    } else {
      console.log(`createdBy ADMIN: ${creator.email}`);
    }

    const existingLeague = await prisma.league.findFirst({
      where: {
        name: {
          equals: LEAGUE_NAME,
          mode: "insensitive"
        }
      },
      select: { id: true, name: true }
    });

    const league = existingLeague
      ? await prisma.league.update({
          where: { id: existingLeague.id },
          data: {
            createdById: creator.id,
            maxAutoSubs: 1,
            maxTeams: ACCOUNT_COUNT,
            name: LEAGUE_NAME,
            passwordHash: hashSecret(LEAGUE_JOIN_PASSWORD),
            startersCount: 5,
            status: LeagueStatus.ACTIVE
          },
          select: { id: true, name: true }
        })
      : await prisma.league.create({
          data: {
            createdById: creator.id,
            maxAutoSubs: 1,
            maxTeams: ACCOUNT_COUNT,
            name: LEAGUE_NAME,
            passwordHash: hashSecret(LEAGUE_JOIN_PASSWORD),
            startersCount: 5,
            status: LeagueStatus.ACTIVE
          },
          select: { id: true, name: true }
        });

    console.log(
      `${existingLeague ? "Lega esistente aggiornata" : "Lega creata"}: ${league.name} (${league.id})`
    );

    const teams: Array<{ id: string; name: string; userId: string }> = [];

    for (let index = 0; index < ACCOUNT_COUNT; index += 1) {
      const user = appUsers[index]!;
      const teamName = testTeamName(index + 1);
      const membershipRole =
        index === 0 ? LeagueRole.OWNER : LeagueRole.MEMBER;

      await prisma.leagueMember.upsert({
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId: user.id
          }
        },
        update: { role: membershipRole },
        create: {
          leagueId: league.id,
          userId: user.id,
          role: membershipRole
        }
      });

      const team = await prisma.fantasyTeam.upsert({
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId: user.id
          }
        },
        update: { name: teamName },
        create: {
          leagueId: league.id,
          userId: user.id,
          name: teamName
        },
        select: {
          id: true,
          name: true,
          userId: true,
          _count: { select: { roster: true } }
        }
      });

      teams.push({ id: team.id, name: team.name, userId: team.userId });
      console.log(
        `Team OK: ${team.name} (${team.id}) roster attuale=${team._count.roster}`
      );
    }

    const needsRosterRebuild =
      rebuildRosters ||
      (
        await Promise.all(
          teams.map(async (team) => {
            const count = await prisma.fantasyRoster.count({
              where: { fantasyTeamId: team.id }
            });
            return count !== REQUIRED_ROSTER_SIZE;
          })
        )
      ).some(Boolean);

    if (needsRosterRebuild) {
      console.log("Ricostruzione rose della sola lega di test...");
      await prisma.fantasyRoster.deleteMany({
        where: { leagueId: league.id }
      });

      const pools = new Map<PlayerRole, PlayerRef[]>();
      for (const role of Object.values(PlayerRole)) {
        const rolePlayers = activePlayers.filter(
          (player) => player.role === role
        );
        pools.set(role, shuffleInPlace([...rolePlayers]));
      }

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
    } else {
      console.log(
        "Rose già complete (25/25) su tutte le squadre — skip rebuild. Usa --rebuild-rosters per rigenerarle."
      );
    }

    for (let index = 0; index < ACCOUNT_COUNT; index += 1) {
      const user = appUsers[index]!;
      const team = teams[index]!;
      const rosterSize = await prisma.fantasyRoster.count({
        where: { fantasyTeamId: team.id }
      });

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

      createdAccounts.push({
        email: user.email,
        password: TEST_PASSWORD,
        appUserId: user.id,
        authUserId: user.authUserId ?? "",
        teamName: team.name,
        rosterSize
      });
    }

    console.log("");
    console.log("=== RISULTATO ===");
    console.log(`League id:   ${league.id}`);
    console.log(`League name: ${league.name}`);
    console.log(`Join password lega: ${LEAGUE_JOIN_PASSWORD}`);
    console.log("");
    console.log("Email | Password | Team | Roster");
    for (const account of createdAccounts) {
      console.log(
        `${account.email} | ${account.password} | ${account.teamName} | ${account.rosterSize}/${REQUIRED_ROSTER_SIZE}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("seed-test-league FALLITO:", error);
  process.exitCode = 1;
});
