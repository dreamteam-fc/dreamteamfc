import { getSupabaseUrl } from "@/lib/supabase/config.ts";

export const TEAM_LOGOS_BUCKET = "team-logos";

/** Max raw upload size accepted by the app. Keep next.config serverActions.bodySizeLimit above this. */
export const TEAM_LOGO_MAX_INPUT_BYTES = 5 * 1024 * 1024;

export function buildTeamLogoStoragePath(leagueId: string, teamId: string) {
  return `leagues/${leagueId}/teams/${teamId}.webp`;
}

export function getTeamLogoPublicUrl(
  logoPath: string | null | undefined,
  cacheBust?: Date | string | number | null
) {
  if (!logoPath) {
    return null;
  }

  const base = `${getSupabaseUrl()}/storage/v1/object/public/${TEAM_LOGOS_BUCKET}/${logoPath}`;

  if (cacheBust == null || cacheBust === "") {
    return base;
  }

  const version =
    cacheBust instanceof Date ? String(cacheBust.getTime()) : String(cacheBust);

  return `${base}?v=${encodeURIComponent(version)}`;
}
