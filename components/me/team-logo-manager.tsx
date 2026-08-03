import {
  removeTeamLogoAction,
  uploadTeamLogoAction
} from "@/app/me/actions";
import { TeamLogo } from "@/components/teams/team-logo";
import { TEAM_LOGO_MAX_INPUT_BYTES } from "@/lib/teams/team-logo-url.ts";

type TeamLogoManagerProps = {
  canManage: boolean;
  logoPath: string | null;
  teamId: string;
  teamName: string;
  updatedAt: Date;
};

export function TeamLogoManager({
  canManage,
  logoPath,
  teamId,
  teamName,
  updatedAt
}: TeamLogoManagerProps) {
  const maxMb = TEAM_LOGO_MAX_INPUT_BYTES / (1024 * 1024);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Logo squadra</h2>
      <p className="mt-2 text-sm text-slate-600">
        Un&apos;immagine quadrata che identifica la squadra. Verra ridimensionata
        e compressa automaticamente (max {maxMb} MB, JPEG/PNG/WebP/GIF).
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-5">
        <TeamLogo
          alt={`Logo ${teamName}`}
          cacheBust={updatedAt}
          logoPath={logoPath}
          size="lg"
        />

        <div className="min-w-0 flex-1 space-y-4">
          {canManage ? (
            <>
              <form
                action={uploadTeamLogoAction}
                className="space-y-3"
                encType="multipart/form-data"
              >
                <input type="hidden" name="teamId" value={teamId} />
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Carica o sostituisci logo</span>
                  <input
                    type="file"
                    name="logo"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                    className="block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                  />
                </label>
                <button type="submit" className="btn-brand">
                  Carica logo
                </button>
              </form>

              {logoPath ? (
                <form action={removeTeamLogoAction}>
                  <input type="hidden" name="teamId" value={teamId} />
                  <button
                    type="submit"
                    className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    Rimuovi logo
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {logoPath
                ? "Solo il proprietario (o un admin) puo modificare il logo."
                : "Nessun logo impostato. Solo il proprietario puo caricarlo."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
