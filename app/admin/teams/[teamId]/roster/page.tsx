import type { PlayerRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import {
  adminAddPlayerToRosterAction,
  adminRemovePlayerFromRosterAction,
  adminReplacePlayerInRosterAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getPlayerRoleFilterLabel,
  getPlayerRoleLabel,
  parsePlayerRoleFilter,
  PLAYER_ROLE_FILTERS
} from "@/lib/players/player-role";
import { getAdminTeamRosterData } from "@/lib/server/rosters/admin-roster-mutations";

export const dynamic = "force-dynamic";

type AdminTeamRosterPageProps = {
  params: Promise<{
    teamId: string;
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
  if (!error && !notice) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? notice}
    </div>
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

function buildRosterPath(options: {
  teamId: string;
  q?: string;
  role?: string;
}) {
  const searchParams = new URLSearchParams();
  if (options.role && options.role !== "ALL") {
    searchParams.set("role", options.role);
  }
  if (options.q && options.q.trim().length > 0) {
    searchParams.set("q", options.q.trim());
  }
  const query = searchParams.toString();
  return query.length > 0
    ? `/admin/teams/${options.teamId}/roster?${query}`
    : `/admin/teams/${options.teamId}/roster`;
}

export default async function AdminTeamRosterPage({
  params,
  searchParams
}: AdminTeamRosterPageProps) {
  await requireAdminAccess();
  const { teamId } = await params;
  const { error, notice, q, role } = await searchParams;
  const roleFilter = parsePlayerRoleFilter(role);
  const searchQuery = q?.trim() ?? "";
  const data = await getAdminTeamRosterData(teamId, {
    roleFilter,
    searchQuery
  });

  if (!data) {
    notFound();
  }

  const redirectPath = buildRosterPath({
    teamId,
    q: data.searchQuery,
    role: roleFilter
  });

  return (
    <AdminShell
      title={`Rosa admin | ${data.team.name}`}
      subtitle={`${data.league?.name ?? "Lega"} — add / remove / replace (stesso ruolo).`}
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Rosa: <strong>{data.rosterValidation.total}/25</strong> (P{" "}
              {data.rosterValidation.goalkeeperCount}/3 · D{" "}
              {data.rosterValidation.defenderCount}/8 · C{" "}
              {data.rosterValidation.midfielderCount}/8 · A{" "}
              {data.rosterValidation.attackerCount}/6)
            </p>
            {data.rosterValidation.errors.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-amber-800">
                {data.rosterValidation.errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : (
              <p className="text-emerald-700">Composizione rosa valida.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/leagues/${data.team.leagueId}/teams`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Torna alle squadre
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rosa attuale</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Giocatore</th>
                <th className="px-3 py-3 font-medium">Ruolo</th>
                <th className="px-3 py-3 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.team.roster.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-3 text-slate-900">
                    <p className="font-medium">{entry.player.name}</p>
                    <p className="text-xs text-slate-500">
                      {entry.player.teamName ?? "Team n/d"}
                      {entry.player.isUnavailable ? " · non disponibile" : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getRoleBadgeClass(entry.player.role)}`}
                    >
                      {getPlayerRoleLabel(entry.player.role)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <form action={adminRemovePlayerFromRosterAction}>
                      <input type="hidden" name="teamId" value={teamId} />
                      <input
                        type="hidden"
                        name="playerId"
                        value={entry.player.id}
                      />
                      <input
                        type="hidden"
                        name="redirectPath"
                        value={redirectPath}
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-100"
                      >
                        Rimuovi
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Sostituisci (stesso ruolo)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Utile per sbloccare rose incomplete senza rompere i vincoli 3P/8D/8C/6A.
        </p>
        <form
          action={adminReplacePlayerInRosterAction}
          className="mt-4 grid gap-3 md:grid-cols-3"
        >
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="redirectPath" value={redirectPath} />
          <label className="text-sm text-slate-700">
            Esce dalla rosa
            <select
              name="outgoingPlayerId"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona
              </option>
              {data.team.roster.map((entry) => (
                <option key={entry.id} value={entry.player.id}>
                  {entry.player.name} ({getPlayerRoleLabel(entry.player.role)})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Entra in rosa
            <select
              name="incomingPlayerId"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona
              </option>
              {data.availablePlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({getPlayerRoleLabel(player.role)})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Sostituisci
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Aggiungi giocatore
          </h2>
          <form className="flex flex-wrap gap-2">
            <input
              type="search"
              name="q"
              defaultValue={data.searchQuery}
              placeholder="Cerca giocatore"
              className="min-w-[220px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input type="hidden" name="role" value={roleFilter} />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Cerca
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PLAYER_ROLE_FILTERS.map((filterOption) => (
            <Link
              key={filterOption}
              href={buildRosterPath({
                teamId,
                q: data.searchQuery,
                role: filterOption
              })}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                roleFilter === filterOption
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {getPlayerRoleFilterLabel(filterOption)}
            </Link>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Giocatore</th>
                <th className="px-3 py-3 font-medium">Ruolo</th>
                <th className="px-3 py-3 font-medium">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.availablePlayers.map((player) => (
                <tr key={player.id}>
                  <td className="px-3 py-3 text-slate-900">
                    <p className="font-medium">{player.name}</p>
                    <p className="text-xs text-slate-500">
                      {player.teamName ?? "Team n/d"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getRoleBadgeClass(player.role)}`}
                    >
                      {getPlayerRoleLabel(player.role)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <form action={adminAddPlayerToRosterAction}>
                      <input type="hidden" name="teamId" value={teamId} />
                      <input type="hidden" name="playerId" value={player.id} />
                      <input
                        type="hidden"
                        name="redirectPath"
                        value={redirectPath}
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                      >
                        Aggiungi
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.availablePlayers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Nessun giocatore disponibile con i filtri correnti.
            </p>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
