import sharp from "sharp";

import {
  toOwnedBlob,
  toOwnedBuffer
} from "@/lib/server/http/owned-buffer.ts";
import { prisma } from "@/lib/prisma.ts";
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

export async function processTeamLogoImage(buffer: Buffer): Promise<Buffer> {
  // Own the input bytes before sharp; own the output before fetch/storage upload.
  const input = toOwnedBuffer(buffer);

  try {
    const processed = await sharp(input, { failOn: "error" })
      .rotate()
      .resize(TEAM_LOGO_OUTPUT_SIZE, TEAM_LOGO_OUTPUT_SIZE, {
        fit: "cover",
        position: "centre"
      })
      .webp({ quality: TEAM_LOGO_WEBP_QUALITY })
      .toBuffer();

    // Sharp → fresh owned Buffer again before any network I/O.
    return toOwnedBuffer(processed);
  } catch (error) {
    console.error("[team-logo] sharp failed:", formatErrorDetails(error));
    throw new Error(
      `Impossibile elaborare l'immagine caricata. (${formatErrorDetails(error)})`
    );
  }
}

async function uploadProcessedLogo(path: string, webpBuffer: Buffer) {
  const supabase = createSupabaseAdminClient();
  // Blob forces supabase-js onto the FormData upload path and keeps undici
  // away from SharedArrayBuffer-backed TypedArray/Buffer bodies.
  const body = toOwnedBlob(webpBuffer, TEAM_LOGO_OUTPUT_MIME);

  try {
    const { error } = await supabase.storage
      .from(TEAM_LOGOS_BUCKET)
      .upload(path, body, {
        cacheControl: "3600",
        contentType: TEAM_LOGO_OUTPUT_MIME,
        upsert: true
      });

    if (error) {
      console.error("[team-logo] storage upload failed:", error.message, error);
      throw new Error(`Upload logo fallito: ${error.message}`);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Upload logo fallito:")
    ) {
      throw error;
    }

    console.error(
      "[team-logo] storage upload threw:",
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

  await uploadProcessedLogo(logoPath, webpBuffer);

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
