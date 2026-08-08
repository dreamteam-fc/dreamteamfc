import type { PlayerRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  generateTournamentRoundRequiredVotesAction,
  importTournamentRoundVotesAction,
  saveBulkTournamentPlayerVotesAction,
  saveSingleTournamentPlayerVoteFromBulkAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdminAccess } from "@/lib/auth/admin.ts";
import {
  getPlayerRoleFilterLabel,
  getPlayerRoleLabel,
  parsePlayerRoleFilter,
  PLAYER_ROLE_FILTERS
} from "@/lib/players/player-role";
import type { AdminVoteStatusFilter } from "@/lib/server/admin/read-admin-data";
import { getAdminTournamentRoundVotesData } from "@/lib/server/admin/read-admin-data";
import { tournamentVoteLegLabel } from "@/lib/server/tournaments/tournament-votes";

export const dynamic = "force-dynamic";

const VOTE_STATUS_FILTERS = [
  "ALL",
  "PENDING",
  "COMPLETED",
  "SV",
  "IGNORED"
] as const satisfies readonly AdminVoteStatusFilter[];

type VotesPageProps = {
  params: Promise<{
    roundId: string;
    tournamentId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    leg?: string;
    notice?: string;
    q?: string;
    role?: string;
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

function parseVoteStatusFilter(value: string | undefined): AdminVoteStatusFilter {
  if (
    typeof value === "string" &&
    VOTE_STATUS_FILTERS.includes(value as AdminVoteStatusFilter)
  ) {
    return value as AdminVoteStatusFilter;
  }

  return "ALL";
}

function parseVoteLeg(value: string | undefined, isFinal: boolean): 1 | 2 {
  if (isFinal) {
    return 1;
  }
  if (value === "2") {
    return 2;
  }
  return 1;
}

function getVoteStatusFilterLabel(status: AdminVoteStatusFilter) {
  switch (status) {
    case "ALL":
      return "Tutti";
    case "PENDING":
      return "Pending";
    case "COMPLETED":
      return "Completed";
    case "SV":
      return "SV";
    case "IGNORED":
      return "Ignored";
    default:
      return status;
  }
}

function getVoteFieldName(playerId: string, fieldName: string) {
  return `votes.${playerId}.${fieldName}`;
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

function FilterLink({
  active,
  href,
  label
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
      }`}
    >
      {label}
    </Link>
  );
}

function buildVotesPagePath(options: {
  leg: 1 | 2;
  q?: string;
  role: string;
  roundId: string;
  status: string;
  tournamentId: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("leg", String(options.leg));
  searchParams.set("role", options.role);
  searchParams.set("status", options.status);

  if (options.q && options.q.trim().length > 0) {
    searchParams.set("q", options.q.trim());
  }

  return `/admin/tournaments/${options.tournamentId}/rounds/${options.roundId}/votes?${searchParams.toString()}`;
}

export default async function AdminTournamentRoundVotesPage({
  params,
  searchParams
}: VotesPageProps) {
  await requireAdminAccess();
  const { tournamentId, roundId } = await params;
  const { error, notice, q, role, status, leg: legParam } = await searchParams;

  // Probe round existence / isFinal with leg=1 first; real leg applied below.
  const probe = await getAdminTournamentRoundVotesData(tournamentId, roundId, {
    leg: 1
  });
  if (!probe) {
    notFound();
  }

  const leg = parseVoteLeg(legParam, probe.round.isFinal);
  const roleFilter = parsePlayerRoleFilter(role);
  const statusFilter = parseVoteStatusFilter(status);
  const searchQuery = q?.trim() ?? "";
  const data =
    leg === 1
      ? probe
      : await getAdminTournamentRoundVotesData(tournamentId, roundId, {
          leg,
          roleFilter,
          searchQuery,
          statusFilter
        });

  if (!data) {
    notFound();
  }

  // Re-fetch with filters when leg===1 (probe had no filters).
  const filteredData =
    leg === 1
      ? await getAdminTournamentRoundVotesData(tournamentId, roundId, {
          leg,
          roleFilter,
          searchQuery,
          statusFilter
        })
      : data;

  if (!filteredData) {
    notFound();
  }

  const legLabel = filteredData.round.isFinal
    ? "Unica gara"
    : tournamentVoteLegLabel(leg);
  const redirectPath = buildVotesPagePath({
    leg,
    q: filteredData.filters.searchQuery,
    role: filteredData.filters.roleFilter,
    roundId,
    status: filteredData.filters.statusFilter,
    tournamentId
  });

  return (
    <AdminShell
      title={`Pagelle torneo | ${filteredData.round.name}`}
      subtitle={`${filteredData.round.tournament.name} · ${legLabel} · Stato torneo ${filteredData.round.tournament.status}`}
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Formazioni gamba:{" "}
              <strong>{filteredData.round.lineupsStatus}</strong>
            </p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              Come in lega: compila più righe e premi Salva tutti. Le righe vuote
              vengono ignorate. I voti sono separati per gamba
              (andata/ritorno).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={filteredData.round.tournament.status} />
            <Link
              href={`/admin/tournaments/${tournamentId}/bracket`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Torna al tabellone
            </Link>
            {!filteredData.round.isFinal ? (
              <div className="flex gap-2">
                <FilterLink
                  active={leg === 1}
                  href={buildVotesPagePath({
                    leg: 1,
                    q: filteredData.filters.searchQuery,
                    role: roleFilter,
                    roundId,
                    status: statusFilter,
                    tournamentId
                  })}
                  label="Andata"
                />
                <FilterLink
                  active={leg === 2}
                  href={buildVotesPagePath({
                    leg: 2,
                    q: filteredData.filters.searchQuery,
                    role: roleFilter,
                    roundId,
                    status: statusFilter,
                    tournamentId
                  })}
                  label="Ritorno"
                />
              </div>
            ) : null}
            <form action={generateTournamentRoundRequiredVotesAction}>
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="roundId" value={roundId} />
              <input type="hidden" name="leg" value={String(leg)} />
              <input type="hidden" name="redirectPath" value={redirectPath} />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Genera lista voti
              </button>
            </form>
            <form
              action={importTournamentRoundVotesAction}
              encType="multipart/form-data"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="roundId" value={roundId} />
              <input type="hidden" name="leg" value={String(leg)} />
              <input type="hidden" name="redirectPath" value={redirectPath} />
              <input type="hidden" name="sheetName" value="Fantacalcio" />
              <label className="text-sm font-medium text-slate-700">
                Import XLS voti
                <input
                  type="file"
                  name="votesFile"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  className="mt-1 block w-full max-w-xs text-sm text-slate-600"
                />
              </label>
              <button
                type="submit"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
              >
                Carica e compila pagelle
              </button>
            </form>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Totale richiesti</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {filteredData.completion.totalRequired}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">
              {filteredData.completion.pendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900">
              {filteredData.completion.completedStatusCount}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm text-sky-700">SV</p>
            <p className="mt-2 text-2xl font-semibold text-sky-900">
              {filteredData.completion.svCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <p className="text-sm text-slate-600">Ignored</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {filteredData.completion.ignoredCount}
            </p>
          </div>
        </div>

        <form className="mt-5 flex flex-wrap gap-3">
          <input type="hidden" name="leg" value={String(leg)} />
          <input type="hidden" name="role" value={roleFilter} />
          <input type="hidden" name="status" value={statusFilter} />
          <input
            type="search"
            name="q"
            defaultValue={filteredData.filters.searchQuery}
            placeholder="Cerca per nome giocatore"
            className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Cerca
          </button>
          {filteredData.filters.searchQuery ? (
            <Link
              href={buildVotesPagePath({
                leg,
                role: roleFilter,
                roundId,
                status: statusFilter,
                tournamentId
              })}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Reset
            </Link>
          ) : null}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {PLAYER_ROLE_FILTERS.map((filterOption) => (
            <FilterLink
              key={filterOption}
              active={roleFilter === filterOption}
              href={buildVotesPagePath({
                leg,
                q: filteredData.filters.searchQuery,
                role: filterOption,
                roundId,
                status: statusFilter,
                tournamentId
              })}
              label={getPlayerRoleFilterLabel(filterOption)}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {VOTE_STATUS_FILTERS.map((filterOption) => (
            <FilterLink
              key={filterOption}
              active={statusFilter === filterOption}
              href={buildVotesPagePath({
                leg,
                q: filteredData.filters.searchQuery,
                role: roleFilter,
                roundId,
                status: filterOption,
                tournamentId
              })}
              label={getVoteStatusFilterLabel(filterOption)}
            />
          ))}
        </div>
      </section>

      {filteredData.totals.totalCount === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Nessun giocatore utile generato per questa gamba. Chiudi le formazioni
          e usa &quot;Genera lista voti&quot;.
        </section>
      ) : filteredData.round.requiredVotePlayers.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {filteredData.filters.searchQuery
            ? `Nessun giocatore trovato per "${filteredData.filters.searchQuery}".`
            : "Nessun giocatore visibile con i filtri correnti."}
        </section>
      ) : (
        <form action={saveBulkTournamentPlayerVotesAction} className="space-y-4">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="leg" value={String(leg)} />
          <input type="hidden" name="redirectPath" value={redirectPath} />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Risultati visibili:{" "}
              <strong>{filteredData.totals.filteredCount}</strong> su{" "}
              <strong>{filteredData.totals.totalCount}</strong>.
            </p>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Salva tutti i voti inseriti
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1200px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Giocatore</th>
                  <th className="px-3 py-3 font-medium">Ruolo</th>
                  <th className="px-3 py-3 font-medium">Stato</th>
                  <th className="px-3 py-3 font-medium">Voto base</th>
                  <th className="px-3 py-3 font-medium">Gol</th>
                  <th className="px-3 py-3 font-medium">Gs</th>
                  <th className="px-3 py-3 font-medium">Assist</th>
                  <th className="px-3 py-3 font-medium">Gialli</th>
                  <th className="px-3 py-3 font-medium">Rossi</th>
                  <th className="px-3 py-3 font-medium">SV</th>
                  <th className="px-3 py-3 font-medium">Note</th>
                  <th className="px-3 py-3 font-medium">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.round.requiredVotePlayers.map((record) => {
                  const saveSingleAction =
                    saveSingleTournamentPlayerVoteFromBulkAction.bind(
                      null,
                      record.player.id
                    );

                  return (
                    <tr
                      key={record.player.id}
                      className={
                        record.status === "PENDING" ? "bg-amber-50/30" : "bg-white"
                      }
                    >
                      <td className="px-3 py-3 align-top text-slate-900">
                        <input
                          type="hidden"
                          name="playerIds"
                          value={record.player.id}
                        />
                        <input
                          type="hidden"
                          name={`playerLabels.${record.player.id}`}
                          value={record.player.name}
                        />
                        <div className="min-w-[220px]">
                          <p className="font-medium">{record.player.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {record.player.teamName ?? "Team non disponibile"} |
                            Utilizzi: {record.usageCount}
                          </p>
                          {record.player.isUnavailable ? (
                            <span className="mt-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                              Non disponibile
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getRoleBadgeClass(record.player.role)}`}
                        >
                          {getPlayerRoleLabel(record.player.role)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-2">
                          <StatusBadge status={record.status} />
                          <p className="text-xs text-slate-500">
                            FV: {record.playerVote?.finalFantavote ?? "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "baseVote")}
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          defaultValue={record.playerVote?.baseVote ?? ""}
                          className="w-24 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "goals")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={record.playerVote?.goals ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(
                            record.player.id,
                            "goalsConceded"
                          )}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={record.playerVote?.goalsConceded ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                          title="Goal subiti (solo portieri; porta inviolata auto se 0)"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "assists")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={record.playerVote?.assists ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(
                            record.player.id,
                            "yellowCards"
                          )}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={record.playerVote?.yellowCards ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "redCards")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={record.playerVote?.redCards ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            name={getVoteFieldName(record.player.id, "isSv")}
                            type="checkbox"
                            defaultChecked={record.playerVote?.isSv ?? false}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          SV
                        </label>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-2">
                          <textarea
                            name={getVoteFieldName(record.player.id, "notes")}
                            rows={2}
                            defaultValue={record.playerVote?.notes ?? ""}
                            className="min-w-[220px] rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              name={getVoteFieldName(
                                record.player.id,
                                "ownGoals"
                              )}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={record.playerVote?.ownGoals ?? 0}
                              placeholder="Au"
                              title="Autogol"
                              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
                            />
                            <input
                              name={getVoteFieldName(
                                record.player.id,
                                "penaltiesSaved"
                              )}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={
                                record.playerVote?.penaltiesSaved ?? 0
                              }
                              placeholder="Rp"
                              title="Rigori parati (+3)"
                              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
                            />
                            <input
                              name={getVoteFieldName(
                                record.player.id,
                                "penaltiesMissed"
                              )}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={
                                record.playerVote?.penaltiesMissed ?? 0
                              }
                              placeholder="Rs"
                              title="Rigori sbagliati (−3)"
                              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              name={getVoteFieldName(
                                record.player.id,
                                "penaltiesScored"
                              )}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={
                                record.playerVote?.penaltiesScored ?? 0
                              }
                              placeholder="Rf"
                              title="Rigori realizzati (+3)"
                              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
                            />
                            <input
                              name={getVoteFieldName(
                                record.player.id,
                                "cleanSheet"
                              )}
                              type="number"
                              min="0"
                              max="1"
                              step="1"
                              defaultValue={record.playerVote?.cleanSheet ?? 0}
                              placeholder="Clean sheet"
                              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          formAction={saveSingleAction}
                          type="submit"
                          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                        >
                          Salva questo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Salva tutti i voti inseriti
            </button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
