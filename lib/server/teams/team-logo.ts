import sharp from "sharp";

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

const ALLOWED_INPUT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

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
  try {
    return await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize(TEAM_LOGO_OUTPUT_SIZE, TEAM_LOGO_OUTPUT_SIZE, {
        fit: "cover",
        position: "centre"
      })
      .webp({ quality: TEAM_LOGO_WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new Error("Impossibile elaborare l'immagine caricata.");
  }
}

async function uploadProcessedLogo(path: string, webpBuffer: Buffer) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(TEAM_LOGOS_BUCKET)
    .upload(path, webpBuffer, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: true
    });

  if (error) {
    throw new Error(`Upload logo fallito: ${error.message}`);
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
