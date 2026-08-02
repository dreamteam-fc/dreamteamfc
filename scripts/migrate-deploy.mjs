#!/usr/bin/env node
/**
 * Railway preDeploy helper: run `prisma migrate deploy` with clear diagnostics.
 * Prefers the image-local CLI (installed with full transitive deps in Dockerfile).
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
const requireFromRoot = createRequire(path.join(root, "package.json"));

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

function canRequire(id) {
  try {
    requireFromRoot.resolve(id);
    return true;
  } catch {
    return false;
  }
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

const localCli = path.join(root, "node_modules", "prisma", "build", "index.js");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const localCliComplete = fs.existsSync(localCli) && canRequire("effect");
const databaseUrl = process.env.DATABASE_URL || "";

console.log("[migrate-deploy] cwd=", process.cwd());
console.log("[migrate-deploy] schema=", exists("prisma/schema.prisma") ? "ok" : "MISSING");
console.log(
  "[migrate-deploy] local CLI=",
  fs.existsSync(localCli)
    ? localCliComplete
      ? `${localCli} (deps ok)`
      : `${localCli} (INCOMPLETE: missing effect)`
    : "MISSING"
);
console.log("[migrate-deploy] DATABASE_URL=", redactDbUrl(databaseUrl));

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
    "[migrate-deploy] HINT: Set DATABASE_URL on Railway (Supabase session pooler :5432 recommended)."
  );
  process.exit(1);
}

if (/:(6543)\b/.test(databaseUrl)) {
  console.warn(
    "[migrate-deploy] WARN: DATABASE_URL looks like Supabase transaction pooler (:6543). Migrations often fail there; prefer session pooler (:5432)."
  );
}

/** @type {{ command: string, args: string[], shell?: boolean }} */
let invocation;
if (localCliComplete) {
  invocation = {
    command: process.execPath,
    args: [localCli, "migrate", "deploy", "--schema", schemaPath]
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

const result = spawnSync(invocation.command, invocation.args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: Boolean(invocation.shell)
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

const code = result.status ?? 1;
if (code !== 0) {
  console.error(`[migrate-deploy] prisma migrate deploy exited with code ${code}`);
  console.error(
    "[migrate-deploy] HINT: Open Railway Pre-deploy logs. Common: P1001 (DB unreachable), MODULE_NOT_FOUND (CLI deps), transaction pooler :6543."
  );
}
process.exit(code);
