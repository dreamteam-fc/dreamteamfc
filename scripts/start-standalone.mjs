#!/usr/bin/env node
/**
 * Railway/Docker-friendly start for Next.js standalone output.
 * Binds 0.0.0.0 and uses process.env.PORT (default 3000).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, "..");
const standaloneDir = path.join(appRoot, ".next", "standalone");
const serverJs = path.join(standaloneDir, "server.js");
const staticSrc = path.join(appRoot, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(appRoot, "public");
const publicDest = path.join(standaloneDir, "public");

if (!fs.existsSync(serverJs)) {
  console.error(`Standalone server missing at ${serverJs}. Did next build run with output: "standalone"?`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(staticDest), { recursive: true });
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
}
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
}

process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";

const child = spawn(process.execPath, [serverJs], {
  cwd: standaloneDir,
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
