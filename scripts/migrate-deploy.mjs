#!/usr/bin/env node
/**
 * Railway preDeploy helper: run `prisma migrate deploy` with clear diagnostics.
 * Prefers the image-local CLI (installed with full transitive deps in Dockerfile).
 *
 * Prisma schema uses `directUrl = env("DIRECT_URL")` for the migrate engine.
 *
 * Prefer DIRECT_URL when set. On Railway (IPv4-only), Supabase "Direct"
 * (db.<project>.supabase.co) is often IPv6-only → P1001. Use Supabase
 * Session mode pooler (*.pooler.supabase.com:5432) as DIRECT_URL instead.
 *
 * Stable pairing (Supabase Free + Railway):
 *   DATABASE_URL = Transaction pooler :6543 + ?pgbouncer=true (app runtime)
 *   DIRECT_URL   = Session pooler :5432 (migrate only; brief connection)
 * If both point at Session :5432, the live app can exhaust ~15 slots and
 * preDeploy never gets a connection (EMAXCONNSESSION). Retries alone cannot fix that.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Log before any filesystem work so Railway Pre-deploy logs never look empty.
console.log("[migrate-deploy] start");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS_MIN = 8000;
const RETRY_DELAY_MS_MAX = 15000;

/** Minimal .env loader for local runs (Railway injects env vars directly). */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env"));

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function redactDbUrl(value) {
  if (!value) return "(unset)";
  try {
    const u = new URL(value);
    if (u.password) u.password = "***";
    return `${u.protocol}//${u.username ? `${u.username}:***@` : ""}${u.host}${u.pathname}${u.search}`;
  } catch {
    return "(set, unparseable)";
  }
}

function urlHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "(unparseable)";
  }
}

function isPoolerHost(value) {
  const host = urlHost(value).toLowerCase();
  return host.includes("pooler");
}

function isSupabaseDirectHost(value) {
  const host = urlHost(value).toLowerCase();
  // db.<project-ref>.supabase.co — Direct connection (often IPv6-only).
  return /^db\.[a-z0-9]+\.supabase\.co(?::\d+)?$/.test(host);
}

/** Ensure Prisma migrate uses a single connection (less pressure on session pool). */
function withConnectionLimit(url, limit = 1) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", String(limit));
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Detect missing pgbouncer=true on Transaction pooler (:6543).
 * App runtime auto-appends it in lib/database-url.ts; Railway env should still set it.
 * Never add pgbouncer=true to DIRECT_URL / Session :5432 (migrate needs full protocol).
 */
function transactionPoolerMissingPgbouncer(url) {
  try {
    const u = new URL(url);
    if (u.port !== "6543") return false;
    const v = (u.searchParams.get("pgbouncer") || "").trim().toLowerCase();
    return !(v === "true" || v === "1" || v === "yes");
  } catch {
    return /:(6543)(?:\/|[?&#]|$)/.test(url) && !/[?&]pgbouncer=(?:true|1|yes)\b/i.test(url);
  }
}

function sleepSync(ms) {
  // Portable sync sleep for the preDeploy CLI (no async main).
  spawnSync(process.execPath, ["-e", `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${ms})`], {
    stdio: "ignore"
  });
}

function retryDelayMs(attempt) {
  // attempt is 1-based after a failure; spread 8–15s with slight growth.
  const span = RETRY_DELAY_MS_MAX - RETRY_DELAY_MS_MIN;
  const t = Math.min(1, (attempt - 1) / Math.max(1, MAX_ATTEMPTS - 2));
  return Math.round(RETRY_DELAY_MS_MIN + span * t);
}

function isRetryablePoolExhaustion(combined) {
  return (
    /EMAXCONNSESSION/i.test(combined) ||
    /max clients reached/i.test(combined) ||
    /max_connections/i.test(combined) ||
    /too many clients/i.test(combined) ||
    /remaining connection slots/i.test(combined)
  );
}

function isUnreachableDb(combined) {
  return (
    /P1001/i.test(combined) ||
    /Can't reach database server/i.test(combined) ||
    /can't reach database server/i.test(combined)
  );
}

function printSessionPoolerHint(context) {
  console.error(
    `[migrate-deploy] HINT IT (${context}): Su Railway (solo IPv4) la Direct Supabase (db.*.supabase.co) è spesso solo IPv6 → irraggiungibile. Imposta DIRECT_URL con la URI Session pooler da Supabase Connect → Session (host *.pooler.supabase.com:5432, user spesso postgres.PROJECTREF). Può coincidere con DATABASE_URL se già in session mode. Poi ridistribuisci.`
  );
  console.error(
    `[migrate-deploy] HINT EN (${context}): Railway is IPv4-only; Supabase Direct (db.*.supabase.co) is often IPv6-only → P1001. Set DIRECT_URL to the Session pooler URI from Supabase Connect → Session (host *.pooler.supabase.com:5432, user often postgres.PROJECTREF). It can match DATABASE_URL if that is already session pooler. Then redeploy.`
  );
}

function printPoolExhaustionHint() {
  console.error(
    "[migrate-deploy] HINT IT: Pool session pieno (EMAXCONNSESSION). Chicken-egg: la vecchia app live tiene tutti gli slot Session (~15 Free) → preDeploy migrate via DIRECT_URL fallisce → la nuova app non sostituisce mai la vecchia. Fix: DATABASE_URL = Transaction :6543 + ?pgbouncer=true (o &pgbouncer=true se c'è già ?sslmode=…); DIRECT_URL = Session :5432 solo per migrate. Se già così ma il pool è ancora pieno: commenta temporaneamente preDeployCommand in railway.toml, ridistribuisci (la nuova app su :6543 libera gli slot), poi riabilita preDeploy; oppure riavvia il progetto Supabase e/o ferma npm run dev locale."
  );
  console.error(
    "[migrate-deploy] HINT EN: Session pool exhausted (EMAXCONNSESSION). Chicken-egg: the old live app holds all Session slots (~15 Free) → preDeploy migrate via DIRECT_URL fails → the new app never replaces the old one. Fix: DATABASE_URL = Transaction :6543 + ?pgbouncer=true (or &pgbouncer=true if ?sslmode=… already present); DIRECT_URL = Session :5432 for migrate only. If already correct but pool still full: temporarily comment out preDeployCommand in railway.toml, redeploy (new app on :6543 frees slots), then re-enable preDeploy; or restart the Supabase project and/or stop local npm run dev."
  );
}

// Docker runner installs Prisma CLI in isolation (/opt/prisma-cli) so npm install
// never mutates the Next standalone tree. Prefer that path; fall back to /app.
const isolatedCli = "/opt/prisma-cli/node_modules/prisma/build/index.js";
const localCli = path.join(root, "node_modules", "prisma", "build", "index.js");
const schemaPath = path.join(root, "prisma", "schema.prisma");

function prismaCliComplete(cliPath) {
  if (!fs.existsSync(cliPath)) return false;
  try {
    createRequire(cliPath).resolve("effect");
    return true;
  } catch {
    return false;
  }
}

const resolvedCli = [isolatedCli, localCli].find(prismaCliComplete) || null;
const databaseUrl = process.env.DATABASE_URL || "";
const directUrlFromEnv = process.env.DIRECT_URL || "";

console.log("[migrate-deploy] cwd=", process.cwd());
console.log("[migrate-deploy] schema=", exists("prisma/schema.prisma") ? "ok" : "MISSING");
console.log(
  "[migrate-deploy] local CLI=",
  resolvedCli
    ? `${resolvedCli} (deps ok)`
    : fs.existsSync(localCli) || fs.existsSync(isolatedCli)
      ? "FOUND but INCOMPLETE (missing effect)"
      : "MISSING"
);
console.log("[migrate-deploy] DATABASE_URL=", redactDbUrl(databaseUrl));
console.log("[migrate-deploy] DIRECT_URL=", redactDbUrl(directUrlFromEnv));

if (!fs.existsSync(schemaPath)) {
  console.error("[migrate-deploy] FATAL: prisma/schema.prisma not found in image.");
  console.error(
    "[migrate-deploy] HINT: Dockerfile must COPY prisma/ and scripts/ into the runner stage."
  );
  process.exit(1);
}

if (!databaseUrl) {
  console.error("[migrate-deploy] FATAL: DATABASE_URL is not set.");
  console.error(
    "[migrate-deploy] HINT: Set DATABASE_URL on Railway (Supabase Transaction pooler :6543 + ?pgbouncer=true for the app)."
  );
  process.exit(1);
}

if (transactionPoolerMissingPgbouncer(databaseUrl)) {
  console.warn(
    "[migrate-deploy] WARN: DATABASE_URL is Transaction pooler (:6543) without pgbouncer=true."
  );
  console.warn(
    "[migrate-deploy] HINT IT: Aggiungi ?pgbouncer=true (o &pgbouncer=true se c'è già ?sslmode=…). Senza, Prisma può fallire a runtime con 42P05 prepared statement already exists. L'app prova ad aggiungerlo in lib/database-url.ts, ma conviene sistemare la var su Railway."
  );
  console.warn(
    "[migrate-deploy] HINT EN: Add ?pgbouncer=true (or &pgbouncer=true if ?sslmode=… already present). Without it Prisma can fail at runtime with 42P05 prepared statement already exists. The app auto-appends it in lib/database-url.ts, but fix the Railway env anyway."
  );
}

// Prisma requires DIRECT_URL when schema has directUrl=. Prefer it for migrate;
// fall back to DATABASE_URL so deploy still attempts when the var is missing.
let migrateUrl = directUrlFromEnv;
let migrateSource = "DIRECT_URL";
if (!migrateUrl) {
  migrateUrl = databaseUrl;
  migrateSource = "DATABASE_URL (fallback)";
  console.warn(
    "[migrate-deploy] WARN: DIRECT_URL is not set; using DATABASE_URL for Prisma directUrl / migrate."
  );
  console.warn(
    "[migrate-deploy] HINT IT: Imposta DIRECT_URL su Railway. Preferisci Session pooler (*.pooler.supabase.com:5432) se Direct IPv6 non è raggiungibile; altrimenti Direct db.*.supabase.co se IPv4/IPv6 funziona."
  );
  console.warn(
    "[migrate-deploy] HINT EN: Set DIRECT_URL on Railway. Prefer Session pooler (*.pooler.supabase.com:5432) when Direct IPv6 is unreachable; use true Direct db.*.supabase.co only if IPv4 add-on or IPv6 works."
  );
}

migrateUrl = withConnectionLimit(migrateUrl, 1);
process.env.DIRECT_URL = migrateUrl;
if (migrateSource === "DIRECT_URL" && directUrlFromEnv) {
  // Keep DATABASE_URL unchanged; only tighten the migrate/directUrl connection.
  console.log(
    "[migrate-deploy] applied connection_limit=1 on DIRECT_URL for migrate"
  );
}

const migrateHost = urlHost(migrateUrl);
console.log(`[migrate-deploy] migrate uses ${migrateSource}; host=${migrateHost}`);
console.log(`[migrate-deploy] migrate URL (redacted)=`, redactDbUrl(migrateUrl));

if (isSupabaseDirectHost(migrateUrl)) {
  console.warn(
    "[migrate-deploy] WARN: migrate host looks like Supabase Direct (db.*.supabase.co)."
  );
  console.warn(
    "[migrate-deploy] WARN: On Railway (IPv4-only) this host is often IPv6-only → P1001 Can't reach database server."
  );
  console.warn(
    "[migrate-deploy] HINT IT: Se preDeploy fallisce con P1001, usa Session pooler come DIRECT_URL (Connect → Session, *.pooler.supabase.com:5432)."
  );
  console.warn(
    "[migrate-deploy] HINT EN: If preDeploy fails with P1001, set DIRECT_URL to Session pooler (Connect → Session, *.pooler.supabase.com:5432)."
  );
} else if (isPoolerHost(migrateUrl)) {
  console.log(
    "[migrate-deploy] migrate host is a pooler — OK for Railway IPv4. Retries enabled for EMAXCONNSESSION."
  );
}

if (/:(6543)\b/.test(migrateUrl) || /:(6543)\b/.test(databaseUrl)) {
  console.warn(
    "[migrate-deploy] WARN: URL looks like Supabase transaction pooler (:6543). Migrations often fail there; use Session pooler :5432 as DIRECT_URL."
  );
}

/** @type {{ command: string, args: string[], shell?: boolean }} */
let invocation;
if (resolvedCli) {
  invocation = {
    command: process.execPath,
    args: [resolvedCli, "migrate", "deploy", "--schema", schemaPath]
  };
} else {
  // Fallback: global `prisma` on PATH (if image installed it that way).
  invocation = {
    command: "prisma",
    args: ["migrate", "deploy", "--schema", schemaPath],
    shell: process.platform === "win32"
  };
}

console.log(
  "[migrate-deploy] running:",
  invocation.command,
  invocation.args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")
);
console.log(
  `[migrate-deploy] retries: up to ${MAX_ATTEMPTS} attempts on pool exhaustion (${RETRY_DELAY_MS_MIN}-${RETRY_DELAY_MS_MAX}ms delay)`
);

let lastCode = 1;
let lastCombined = "";

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  if (attempt > 1) {
    const delay = retryDelayMs(attempt);
    console.warn(
      `[migrate-deploy] retry ${attempt}/${MAX_ATTEMPTS} after pool exhaustion; waiting ${delay}ms…`
    );
    sleepSync(delay);
  } else {
    console.log(`[migrate-deploy] attempt ${attempt}/${MAX_ATTEMPTS}`);
  }

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: Boolean(invocation.shell),
    maxBuffer: 16 * 1024 * 1024
  });

  if (result.error) {
    console.error("[migrate-deploy] spawn failed:", result.error.message);
    if (result.error.code === "ENOENT") {
      console.error(
        "[migrate-deploy] HINT: Prisma CLI not found. Dockerfile should `npm install prisma@<lockfile-version>` so transitive deps (effect) are present."
      );
    }
    process.exit(1);
  }

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  lastCode = result.status ?? 1;
  lastCombined = `${stdout}\n${stderr}`;

  if (lastCode === 0) {
    console.log(`[migrate-deploy] prisma migrate deploy succeeded on attempt ${attempt}`);
    process.exit(0);
  }

  const unreachable = isUnreachableDb(lastCombined);
  const poolFull = isRetryablePoolExhaustion(lastCombined);

  if (unreachable && isSupabaseDirectHost(migrateUrl)) {
    console.error(
      `[migrate-deploy] prisma migrate deploy exited with code ${lastCode} (P1001 / unreachable Direct host)`
    );
    printSessionPoolerHint("P1001 on db.*.supabase.co");
    process.exit(lastCode);
  }

  if (unreachable) {
    console.error(
      `[migrate-deploy] prisma migrate deploy exited with code ${lastCode} (P1001 / unreachable)`
    );
    printSessionPoolerHint("P1001");
    process.exit(lastCode);
  }

  if (poolFull && attempt < MAX_ATTEMPTS) {
    console.warn(
      `[migrate-deploy] attempt ${attempt} failed: session pool exhausted (EMAXCONNSESSION / max clients)`
    );
    printPoolExhaustionHint();
    continue;
  }

  if (poolFull) {
    console.error(
      `[migrate-deploy] prisma migrate deploy exited with code ${lastCode} after ${MAX_ATTEMPTS} attempts (pool still full)`
    );
    printPoolExhaustionHint();
    process.exit(lastCode);
  }

  // Non-retryable failure
  console.error(`[migrate-deploy] prisma migrate deploy exited with code ${lastCode}`);
  console.error(
    "[migrate-deploy] HINT: Open Railway Pre-deploy logs. Common: P1001 (Railway IPv4 vs Direct IPv6 — use Session pooler as DIRECT_URL), EMAXCONNSESSION (pooler full — retries help), MODULE_NOT_FOUND (CLI deps), transaction pooler :6543."
  );
  if (isSupabaseDirectHost(migrateUrl)) {
    printSessionPoolerHint("migrate failed with Direct host");
  }
  process.exit(lastCode);
}

process.exit(lastCode);
