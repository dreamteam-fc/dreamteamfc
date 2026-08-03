#!/usr/bin/env node
/**
 * Production start for Next.js standalone (Docker/Railway + local).
 *
 * CRITICAL: Always force HOSTNAME=0.0.0.0.
 * Railway (and many orchestrators) inject HOSTNAME as the container name.
 * Next standalone does `process.env.HOSTNAME || "0.0.0.0"`, so a container
 * hostname makes the server bind to an unreachable interface → Railway
 * Network healthcheck fails with "service unavailable" even though logs show Ready.
 *
 * Layouts:
 * - Docker runner: /app/server.js (standalone copied to WORKDIR)
 * - Local after `next build`: .next/standalone/server.js
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const candidates = [
  path.join(appRoot, "server.js"),
  path.join(appRoot, ".next", "standalone", "server.js")
];

const serverJs = candidates.find((p) => fs.existsSync(p));
if (!serverJs) {
  console.error(
    "[start] Standalone server.js not found. Did next build run with output: \"standalone\"?"
  );
  process.exit(1);
}

const serverDir = path.dirname(serverJs);
const isLocalStandalone = serverJs.includes(
  `${path.sep}.next${path.sep}standalone`
);

if (isLocalStandalone) {
  const staticSrc = path.join(appRoot, ".next", "static");
  const staticDest = path.join(serverDir, ".next", "static");
  const publicSrc = path.join(appRoot, "public");
  const publicDest = path.join(serverDir, "public");

  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true });
  }
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
  }
}

// Force bind-all — do not keep Railway/container HOSTNAME.
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";

console.log(
  `[start] hostname=${process.env.HOSTNAME} port=${process.env.PORT} server=${serverJs}`
);

const child = spawn(process.execPath, [serverJs], {
  cwd: serverDir,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
