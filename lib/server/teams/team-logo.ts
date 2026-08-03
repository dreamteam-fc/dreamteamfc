import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

import {
  toOwnedBuffer,
  toOwnedUint8Array
} from "@/lib/server/http/owned-buffer.ts";
import { prisma } from "@/lib/prisma.ts";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl
} from "@/lib/supabase/config.ts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.ts";
import {
  TEAM_LOGO_MAX_INPUT_BYTES,
  TEAM_LOGOS_BUCKET,
  buildTeamLogoStoragePath
} from "@/lib/teams/team-logo-url.ts";

export {
  TEAM_LOGO_MAX_INPUT_BYTES,
  TEAM_LOGOS_BUCKET,
  buildTeamLogoStoragePath,
  getTeamLogoPublicUrl
} from "@/lib/teams/team-logo-url.ts";

export const TEAM_LOGO_OUTPUT_SIZE = 512;
export const TEAM_LOGO_WEBP_QUALITY = 80;
export const TEAM_LOGO_OUTPUT_MIME = "image/webp";

const ALLOWED_INPUT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function formatErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  if (error.cause instanceof Error && error.cause.message) {
    parts.push(`cause=${error.cause.message}`);
  } else if (error.cause != null) {
    parts.push(`cause=${String(error.cause)}`);
  }

  return parts.filter(Boolean).join(" | ");
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "fantacalcetto-logo-"));

  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {
      // Best-effort cleanup; temp dirs are under OS temp.
    });
  }
}

export function assertAllowedLogoMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();

  if (!ALLOWED_INPUT_MIME_TYPES.has(normalized)) {
    throw new Error(
      "Formato immagine non supportato. Usa JPEG, PNG, WebP o GIF."
    );
  }
}

export function assertLogoInputSize(byteLength: number) {
  if (byteLength <= 0) {
    throw new Error("Il file immagine e vuoto.");
  }

  if (byteLength > TEAM_LOGO_MAX_INPUT_BYTES) {
    throw new Error("Il logo supera il limite di 5 MB.");
  }
}

/**
 * Resize/compress via sharp using on-disk paths so native/libvips never
 * feeds SharedArrayBuffer-backed views into later network I/O.
 */
export async function processTeamLogoImage(buffer: Buffer): Promise<Buffer> {
  const input = toOwnedBuffer(buffer);

  try {
    return await withTempDir(async (dir) => {
      const inputPath = path.join(dir, "input.bin");
      const outputPath = path.join(dir, "output.webp");

      await writeFile(inputPath, input);

      await sharp(inputPath, { failOn: "error" })
        .rotate()
        .resize(TEAM_LOGO_OUTPUT_SIZE, TEAM_LOGO_OUTPUT_SIZE, {
          fit: "cover",
          position: "centre"
        })
        .webp({ quality: TEAM_LOGO_WEBP_QUALITY })
        .toFile(outputPath);

      return toOwnedBuffer(await readFile(outputPath));
    });
  } catch (error) {
    console.error("[team-logo] sharp failed:", formatErrorDetails(error));
    throw new Error(
      `Impossibile elaborare l'immagine caricata. (${formatErrorDetails(error)})`
    );
  }
}

/**
 * Upload a processed WebP to Supabase Storage via the REST API directly.
 *
 * Bypasses @supabase/storage-js body encoding (FormData/Blob/TypedArray),
 * which on Node 22 + undici still hits:
 * "ArrayBuffer: SharedArrayBuffer is not allowed."
 *
 * Body bytes always come from a disk read + owned Uint8Array copy.
 */
export async function uploadTeamLogoObject(
  objectPath: string,
  webpBuffer: Buffer
) {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const baseUrl = getSupabaseUrl().replace(/\/+$/u, "");
  const url = `${baseUrl}/storage/v1/object/${TEAM_LOGOS_BUCKET}/${objectPath}`;

  try {
    await withTempDir(async (dir) => {
      const filePath = path.join(dir, "logo.webp");
      await writeFile(filePath, toOwnedBuffer(webpBuffer));

      // Fresh copy from disk — never a SharedArrayBuffer-backed view.
      const fromDisk = await readFile(filePath);
      const body = toOwnedUint8Array(fromDisk);

      if (body.buffer instanceof SharedArrayBuffer) {
        throw new Error(
          "Buffer interno non valido (SharedArrayBuffer). Riprova."
        );
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": TEAM_LOGO_OUTPUT_MIME,
          "cache-control": "3600",
          "x-upsert": "true"
        },
        body
      });

      if (!response.ok) {
        const detail = (await response.text()).trim() || response.statusText;
        console.error(
          "[team-logo] storage REST upload failed:",
          response.status,
          detail
        );
        throw new Error(
          `Upload logo fallito: ${response.status} ${detail}`.trim()
        );
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Upload logo fallito:")
    ) {
      throw error;
    }

    console.error(
      "[team-logo] storage REST upload threw:",
      formatErrorDetails(error)
    );
    throw new Error(`Upload logo fallito: ${formatErrorDetails(error)}`);
  }
}

export async function deleteTeamLogoObject(logoPath: string | null | undefined) {
  if (!logoPath) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(TEAM_LOGOS_BUCKET)
    .remove([logoPath]);

  if (error) {
    throw new Error(`Eliminazione logo fallita: ${error.message}`);
  }
}

export async function uploadTeamLogo(options: {
  leagueId: string;
  mimeType: string;
  rawBuffer: Buffer;
  teamId: string;
}) {
  assertAllowedLogoMimeType(options.mimeType);
  assertLogoInputSize(options.rawBuffer.byteLength);

  const webpBuffer = await processTeamLogoImage(options.rawBuffer);
  const logoPath = buildTeamLogoStoragePath(options.leagueId, options.teamId);

  await uploadTeamLogoObject(logoPath, webpBuffer);

  return prisma.fantasyTeam.update({
    where: { id: options.teamId },
    data: { logoPath },
    select: {
      id: true,
      leagueId: true,
      logoPath: true,
      updatedAt: true
    }
  });
}

export async function removeTeamLogo(teamId: string) {
  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      leagueId: true,
      logoPath: true
    }
  });

  if (!team) {
    throw new Error("Squadra non trovata.");
  }

  if (!team.logoPath) {
    return team;
  }

  await deleteTeamLogoObject(team.logoPath);

  return prisma.fantasyTeam.update({
    where: { id: teamId },
    data: { logoPath: null },
    select: {
      id: true,
      leagueId: true,
      logoPath: true,
      updatedAt: true
    }
  });
}
