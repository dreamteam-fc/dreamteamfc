import type { PlayerRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import {
  blockPlayerInLeagueAction,
  unblockPlayerInLeagueAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getPlayerRoleFilterLabel,
  getPlayerRoleLabel,
  parsePlayerRoleFilter,
  PLAYER_ROLE_FILTERS
} from "@/lib/players/player-role";
import { getAdminLeaguePlayersData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type AdminLeaguePlayersPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    notice?: string;
    q?: string;
    role?: string;
  }>;
};

function Feedback({
  error,
  notice
}: {
  error?: string;
  notice?: string;
}) {
  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
    </>
  );
}

function getRoleBadgeClass(role: PlayerRole) {
  switch (role) {
    case "GOALKEEPER":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "DEFENDER":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "MIDFIELDER":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "ATTACKER":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function buildPlayersPagePath(
  leagueId: string,
  roleFilter: string,
  searchQuery: string
) {
  const searchParams = new URLSearchParams();
  searchParams.set("role", roleFilter);

  if (searchQuery.trim().length > 0) {
    searchParams.set("q", searchQuery.trim());
  }

  return `/admin/leagues/${leagueId}/players?${searchParams.toString()}`;
}

export default async function AdminLeaguePlayersPage({
  params,
  searchParams
}: AdminLeaguePlayersPageProps) {
  await requireAdminAccess();
  const { leagueId } = await params;
  const { error, notice, q, role } = await searchParams;
  const roleFilter = parsePlayerRoleFilter(role);
  const searchQuery = q?.trim() ?? "";
  const data = await getAdminLeaguePlayersData(leagueId, roleFilter, searchQuery);

  if (!data) {
    notFound();
  }

  const redirectPath = buildPlayersPagePath(
    data.league.id,
    roleFilter,
    data.searchQuery
  );

  return (
    <AdminShell
      title="Giocatori lega"
      subtitle={`Blocca o sblocca giocatori solo per la lega ${data.league.name}, senza disattivarli globalmente.`}
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{data.league.name}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Sono mostrati solo i giocatori attivi globalmente.
            </p>
          </div>

          <Link
            href={`/admin/leagues/${data.league.id}/schedule`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Torna al calendario
          </Link>
        </div>

        <form className="mt-5 flex flex-wrap gap-3">
          <input type="hidden" name="role" value={roleFilter} />
          <input
            type="search"
            name="q"
            defaultValue={data.searchQuery}
            placeholder="Cerca per nome giocatore"
            className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Cerca
          </button>
          {data.searchQuery ? (
            <Link
              href={buildPlayersPagePath(data.league.id, roleFilter, "")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Reset
            </Link>
          ) : null}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {PLAYER_ROLE_FILTERS.map((filterOption) => (
            <Link
              key={filterOption}
              href={buildPlayersPagePath(data.league.id, filterOption, data.searchQuery)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                roleFilter === filterOption
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {getPlayerRoleFilterLabel(filterOption)}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {data.players.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            {data.searchQuery
              ? `Nessun giocatore trovato per "${data.searchQuery}".`
              : "Nessun giocatore disponibile per il filtro selezionato."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Giocatore</th>
                  <th className="px-3 py-2 font-medium">Ruolo</th>
                  <th className="px-3 py-2 font-medium">Squadra reale</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Stato</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.players.map((player) => (
                  <tr key={player.id}>
                    <td className="px-3 py-2 text-slate-900">{player.name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getRoleBadgeClass(player.role)}`}
                      >
                        {getPlayerRoleLabel(player.role)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {player.teamName ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {player.source ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {player.isBlockedInLeague ? (
                        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                          Bloccato in questa lega
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          Disponibile
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {player.blockReason ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {player.isBlockedInLeague ? (
                        <form action={unblockPlayerInLeagueAction} className="space-y-2">
                          <input type="hidden" name="leagueId" value={data.league.id} />
                          <input type="hidden" name="playerId" value={player.id} />
                          <input type="hidden" name="redirectPath" value={redirectPath} />
                          <button
                            type="submit"
                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                          >
                            Sblocca
                          </button>
                        </form>
                      ) : (
                        <form action={blockPlayerInLeagueAction} className="space-y-2">
                          <input type="hidden" name="leagueId" value={data.league.id} />
                          <input type="hidden" name="playerId" value={player.id} />
                          <input type="hidden" name="redirectPath" value={redirectPath} />
                          <input
                            type="text"
                            name="reason"
                            placeholder="Reason opzionale"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-100"
                          >
                            Blocca
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
