#!/usr/bin/env node
/**
 * Railway preDeploy helper: run `prisma migrate deploy` with clear diagnostics.
 * Prefer local CLI (node_modules), then global `prisma` on PATH.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

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

const localCli = path.join(root, "node_modules", "prisma", "build", "index.js");
const schemaPath = path.join(root, "prisma", "schema.prisma");

console.log("[migrate-deploy] cwd=", process.cwd());
console.log("[migrate-deploy] schema=", exists("prisma/schema.prisma") ? "ok" : "MISSING");
console.log("[migrate-deploy] local CLI=", fs.existsSync(localCli) ? localCli : "MISSING");
console.log("[migrate-deploy] DATABASE_URL=", redactDbUrl(process.env.DATABASE_URL));
console.log("[migrate-deploy] DIRECT_URL=", redactDbUrl(process.env.DIRECT_URL));

if (!fs.existsSync(schemaPath)) {
  console.error("[migrate-deploy] FATAL: prisma/schema.prisma not found in image.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("[migrate-deploy] FATAL: DATABASE_URL is not set.");
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.error(
    "[migrate-deploy] FATAL: DIRECT_URL is not set. Set it on Railway to the Supabase session/direct URL (port 5432), not the transaction pooler (6543)."
  );
  process.exit(1);
}

/** @type {{ command: string, args: string[], shell?: boolean }} */
let invocation;
if (fs.existsSync(localCli)) {
  invocation = {
    command: process.execPath,
    args: [localCli, "migrate", "deploy", "--schema", schemaPath]
  };
} else {
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
      "[migrate-deploy] HINT: Prisma CLI binary not found. Image should install prisma globally or copy node_modules/prisma + transitive deps."
    );
  }
  process.exit(1);
}

const code = result.status ?? 1;
if (code !== 0) {
  console.error(`[migrate-deploy] prisma migrate deploy exited with code ${code}`);
  console.error(
    "[migrate-deploy] HINT: Open Railway Pre-deploy → View logs. Common codes: P1001 (DB unreachable), EACCES (permissions), MODULE_NOT_FOUND (CLI deps)."
  );
}
process.exit(code);
