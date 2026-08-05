import type { PlayerRole } from "@prisma/client";
import Link from "next/link";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import {
  deactivatePlayerGloballyAction,
  importFantacalcioQuotazioniCatalogAction,
  reactivatePlayerGloballyAction,
  wipeLeaguesAction,
  wipeTournamentsAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import {
  getPlayerRoleFilterLabel,
  getPlayerRoleLabel,
  parsePlayerRoleFilter,
  PLAYER_ROLE_FILTERS
} from "@/lib/players/player-role";
import {
  getAdminPlayersData,
  type AdminPlayerSourceFilter,
  type AdminPlayerStatusFilter
} from "@/lib/server/admin/read-admin-data";
import { getPlayerCatalogImportMode } from "@/lib/server/players/sync-fantacalcio-quotazioni-catalog";

export const dynamic = "force-dynamic";

const SOURCE_FILTERS = ["ALL", "demo", "fantacalcio-quotazioni", "api-football", "unknown"] as const;
const STATUS_FILTERS = ["ALL", "ACTIVE", "INACTIVE"] as const;

type AdminPlayersPageProps = {
  searchParams: Promise<{
    error?: string;
    notice?: string;
    q?: string;
    role?: string;
    source?: string;
    status?: string;
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

function parseSourceFilter(
  value: string | null | undefined
): AdminPlayerSourceFilter {
  if (typeof value === "string" && SOURCE_FILTERS.includes(value as AdminPlayerSourceFilter)) {
    return value as AdminPlayerSourceFilter;
  }

  return "ALL";
}

function parseStatusFilter(
  value: string | null | undefined
): AdminPlayerStatusFilter {
  if (typeof value === "string" && STATUS_FILTERS.includes(value as AdminPlayerStatusFilter)) {
    return value as AdminPlayerStatusFilter;
  }

  return "ALL";
}

function getSourceFilterLabel(source: AdminPlayerSourceFilter) {
  switch (source) {
    case "ALL":
      return "Tutte le sorgenti";
    case "api-football":
      return "api-football";
    case "fantacalcio-quotazioni":
      return "fantacalcio-quotazioni";
    case "demo":
      return "demo";
    case "unknown":
      return "Senza source";
    default:
      return source;
  }
}

function getStatusFilterLabel(status: AdminPlayerStatusFilter) {
  switch (status) {
    case "ALL":
      return "Tutti";
    case "ACTIVE":
      return "Attivi";
    case "INACTIVE":
      return "Inattivi";
    default:
      return status;
  }
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

function buildAdminPlayersPath(options: {
  q?: string;
  role: string;
  source: string;
  status: string;
}) {
  const searchParams = new URLSearchParams();

  searchParams.set("role", options.role);
  searchParams.set("source", options.source);
  searchParams.set("status", options.status);

  if (options.q && options.q.trim().length > 0) {
    searchParams.set("q", options.q.trim());
  }

  return `/admin/players?${searchParams.toString()}`;
}

export default async function AdminPlayersPage({
  searchParams
}: AdminPlayersPageProps) {
  await requireAdminAccess();
  const { error, notice, q, role, source, status } = await searchParams;
  const roleFilter = parsePlayerRoleFilter(role);
  const sourceFilter = parseSourceFilter(source);
  const statusFilter = parseStatusFilter(status);
  const searchQuery = q?.trim() ?? "";
  const [data, catalogMode] = await Promise.all([
    getAdminPlayersData({
      roleFilter,
      searchQuery,
      sourceFilter,
      statusFilter
    }),
    getPlayerCatalogImportMode()
  ]);

  const redirectPath = buildAdminPlayersPath({
    q: data.filters.searchQuery,
    role: data.filters.roleFilter,
    source: data.filters.sourceFilter,
    status: data.filters.statusFilter
  });

  return (
    <AdminShell
      title="Giocatori"
      subtitle="Gestione globale dei giocatori importati. La disattivazione globale li rende non selezionabili in tutte le leghe; i blocchi per singola lega restano separati."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Catalogo quotazioni Fantacalcio
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Carica un XLSX con i fogli Portieri, Difensori, Centrocampisti,
              Attaccanti (colonne Id, R, Nome, Squadra).
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Fine anno: WIPE TORNEO → WIPE LEGHE → upload XLS (wipe lista). Con
              leghe/tornei presenti l&apos;upload fa sync (upsert, mai delete dei
              Cod mancanti).
            </p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              catalogMode.mode === "wipe"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-sky-300 bg-sky-50 text-sky-900"
            }`}
          >
            Mode: {catalogMode.mode === "wipe" ? "WIPE lista" : "SYNC"}
            <div className="mt-1 text-xs font-normal opacity-80">
              Leghe: {catalogMode.leagueCount} · Tornei:{" "}
              {catalogMode.tournamentCount}
            </div>
          </div>
        </div>

        <form
          action={importFantacalcioQuotazioniCatalogAction}
          encType="multipart/form-data"
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="redirectPath" value={redirectPath} />
          <label className="block space-y-2 text-sm text-slate-700">
            <span className="font-medium">File quotazioni (.xlsx)</span>
            <input
              type="file"
              name="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
            />
          </label>
          <PendingSubmitButton
            pendingLabel={
              catalogMode.mode === "wipe"
                ? "Wipe lista in corso…"
                : "Sync lista in corso…"
            }
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {catalogMode.mode === "wipe"
              ? "Carica e WIPE lista"
              : "Carica e SYNC lista"}
          </PendingSubmitButton>
        </form>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Fine anno / wipe piattaforma
        </h2>
        <p className="mt-2 text-sm text-rose-700">
          Conferme tipizzate obbligatorie. Ordine: WIPE TORNEO → WIPE LEGHE →
          upload XLS sopra.
        </p>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <form action={wipeTournamentsAction} className="space-y-4">
            <input type="hidden" name="redirectPath" value={redirectPath} />
            <h3 className="text-sm font-semibold text-slate-900">
              1. WIPE TORNEO
            </h3>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">
                Digita <code>WIPE TORNEO</code>
              </span>
              <input
                type="text"
                name="confirmation"
                placeholder="WIPE TORNEO"
                autoComplete="off"
                className="w-full rounded-xl border border-rose-300 px-3 py-2"
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Wipe tornei…"
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              WIPE TORNEO
            </PendingSubmitButton>
          </form>

          <form action={wipeLeaguesAction} className="space-y-4">
            <input type="hidden" name="redirectPath" value={redirectPath} />
            <h3 className="text-sm font-semibold text-slate-900">
              2. WIPE LEGHE
            </h3>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">
                Digita <code>WIPE LEGHE</code>
              </span>
              <input
                type="text"
                name="confirmation"
                placeholder="WIPE LEGHE"
                autoComplete="off"
                className="w-full rounded-xl border border-rose-300 px-3 py-2"
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Wipe leghe…"
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              WIPE LEGHE
            </PendingSubmitButton>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Totale giocatori</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {data.counts.total}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Totale attivi</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">
              {data.counts.active}
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">Totale inattivi</p>
            <p className="mt-2 text-3xl font-semibold text-rose-900">
              {data.counts.inactive}
            </p>
          </div>
        </div>

        <form className="mt-5 flex flex-wrap gap-3">
          <input type="hidden" name="role" value={roleFilter} />
          <input type="hidden" name="source" value={sourceFilter} />
          <input type="hidden" name="status" value={statusFilter} />
          <input
            type="search"
            name="q"
            defaultValue={data.filters.searchQuery}
            placeholder="Cerca per nome giocatore"
            className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Cerca
          </button>
          {data.filters.searchQuery ? (
            <Link
              href={buildAdminPlayersPath({
                role: roleFilter,
                source: sourceFilter,
                status: statusFilter
              })}
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
              href={buildAdminPlayersPath({
                q: data.filters.searchQuery,
                role: filterOption,
                source: sourceFilter,
                status: statusFilter
              })}
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

        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((filterOption) => (
            <Link
              key={filterOption}
              href={buildAdminPlayersPath({
                q: data.filters.searchQuery,
                role: roleFilter,
                source: filterOption,
                status: statusFilter
              })}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                sourceFilter === filterOption
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {getSourceFilterLabel(filterOption)}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filterOption) => (
            <Link
              key={filterOption}
              href={buildAdminPlayersPath({
                q: data.filters.searchQuery,
                role: roleFilter,
                source: sourceFilter,
                status: filterOption
              })}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                statusFilter === filterOption
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {getStatusFilterLabel(filterOption)}
            </Link>
          ))}
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Risultati filtrati: <strong>{data.counts.filtered}</strong>. Limite visualizzato:{" "}
          <strong>{data.limit}</strong>.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {data.players.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            {data.filters.searchQuery
              ? `Nessun giocatore trovato per "${data.filters.searchQuery}".`
              : "Nessun giocatore trovato per i filtri selezionati."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Giocatore</th>
                    <th className="px-3 py-2 font-medium">Ruolo</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">External ID</th>
                    <th className="px-3 py-2 font-medium">Stato</th>
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
                        {player.source?.trim() ? player.source : "unknown"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {player.externalId?.trim() ? player.externalId : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {player.isActive ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            Attivo
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                            Inattivo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {player.isActive ? (
                          <form action={deactivatePlayerGloballyAction}>
                            <input type="hidden" name="playerId" value={player.id} />
                            <input
                              type="hidden"
                              name="redirectPath"
                              value={redirectPath}
                            />
                            <button
                              type="submit"
                              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-100"
                            >
                              Disattiva
                            </button>
                          </form>
                        ) : (
                          <form action={reactivatePlayerGloballyAction}>
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
                              Riattiva
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.hasMore ? (
              <p className="mt-4 text-sm text-slate-600">
                Sono mostrati i primi {data.limit} risultati su {data.counts.filtered}.
                Usa i filtri o la ricerca per restringere l&apos;elenco.
              </p>
            ) : null}
          </>
        )}
      </section>
    </AdminShell>
  );
}
