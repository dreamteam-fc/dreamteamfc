import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminAccess } from "@/lib/auth/admin.ts";
import { getPlayerRoleLabel } from "@/lib/players/player-role";
import { REQUIRED_ROSTER_SIZE } from "@/lib/server/rosters/validate-roster-composition";
import { listUnalignedRosters } from "@/lib/server/rosters/roster-alignment";

export const dynamic = "force-dynamic";

export default async function AdminRoseDaSanarePage() {
  await requireAdminAccess();
  const unaligned = await listUnalignedRosters();

  return (
    <AdminShell
      eyebrow="Admin"
      title="Rose da sanare"
      subtitle="Squadre con giocatori usciti dalla lista Fantacalcio. Finché questa lista non è vuota non è possibile aprire le formazioni, né di lega né di torneo."
    >
      {unaligned.length === 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-sm text-emerald-800">
            Tutte le rose sono allineate alla lista giocatori. Le formazioni si
            possono aprire.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Freeze attivo: {unaligned.length}{" "}
            {unaligned.length === 1 ? "squadra" : "squadre"} da sanare. Sostituisci
            ogni giocatore non disponibile con uno dello stesso ruolo dalla pagina
            rosa della squadra.
          </section>

          <div className="space-y-4">
            {unaligned.map((team) => (
              <section
                key={team.fantasyTeamId}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {team.fantasyTeamName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {team.leagueName} | Rosa: {team.rosterCount}/
                      {REQUIRED_ROSTER_SIZE}
                      {team.rosterCount !== REQUIRED_ROSTER_SIZE ? (
                        <span className="ml-2 font-medium text-amber-700">
                          rosa incompleta
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Link
                    href={`/admin/teams/${team.fantasyTeamId}/roster`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Sana rosa
                  </Link>
                </div>

                <ul className="mt-4 space-y-2">
                  {team.players.map((player) => (
                    <li
                      key={player.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                    >
                      <span className="font-semibold">{player.name}</span>
                      <span className="text-rose-600">
                        {getPlayerRoleLabel(player.role)}
                        {player.teamName ? ` | ${player.teamName}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
