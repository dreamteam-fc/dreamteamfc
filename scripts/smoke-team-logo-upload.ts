/**
 * One-off smoke test for team logo upload.
 * Uses the same process + REST upload path as production (uploadTeamLogoObject).
 *
 *   npx tsx scripts/smoke-team-logo-upload.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  deleteTeamLogoObject,
  processTeamLogoImage,
  uploadTeamLogoObject
} from "../lib/server/teams/team-logo.ts";

function loadLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const fileContent = readFileSync(envPath, "utf8");

  for (const rawLine of fileContent.split(/\r?\n/u)) {
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

async function main() {
  loadLocalEnvFile();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante nel .env");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante nel .env");
  }

  const pngBuffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 16, g: 185, b: 129 }
    }
  })
    .png()
    .toBuffer();

  const objectPath = `_smoke/${randomUUID()}.webp`;
  console.log(`[smoke] processing + uploading ${objectPath}`);

  const webpBuffer = await processTeamLogoImage(pngBuffer);
  console.log(`[smoke] processed bytes=${webpBuffer.byteLength}`);

  await uploadTeamLogoObject(objectPath, webpBuffer);
  console.log("[smoke] UPLOAD OK");

  await deleteTeamLogoObject(objectPath);
  console.log("[smoke] CLEANUP OK");
}

main()
  .then(() => {
    console.log("[smoke] SUCCESS");
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[smoke] FAIL:", message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
