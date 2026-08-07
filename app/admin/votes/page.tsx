import type { PlayerRole } from "@prisma/client";
import Link from "next/link";

import {
  calculateAllScoresAndResultsAction,
  generateRequiredVotesForUnifiedMatchdayNumberAction,
  importFantacalcioVotesAcrossLeaguesAction,
  publishAllMatchdaysAction,
  saveBulkUnifiedPlayerVotesAction,
  saveSingleUnifiedPlayerVoteAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireStaffAccess } from "@/lib/auth/admin.ts";
import { canManagePlatform } from "@/lib/auth/app-roles.ts";
import { getPlayerRoleLabel } from "@/lib/players/player-role";
import { getAdminUnifiedVotesData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Multi-league XLS import + list generation can exceed default limits on Railway. */
export const maxDuration = 300;

type UnifiedVotesPageProps = {
  searchParams: Promise<{
    error?: string;
    n?: string;
    notice?: string;
    q?: string;
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
      className={`rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap break-words ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? notice}
    </div>
  );
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

function buildUnifiedVotesPath(options: { n?: number | null; q?: string }) {
  const searchParams = new URLSearchParams();

  if (typeof options.n === "number" && Number.isFinite(options.n)) {
    searchParams.set("n", String(options.n));
  }

  if (options.q && options.q.trim().length > 0) {
    searchParams.set("q", options.q.trim());
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/admin/votes?${query}` : "/admin/votes";
}

function parseMatchdayNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function AdminUnifiedVotesPage({
  searchParams
}: UnifiedVotesPageProps) {
  const { error, n, notice, q } = await searchParams;
  const authContext = await requireStaffAccess();
  const showPlatform = canManagePlatform(authContext.appUser.role);
  const matchdayNumber = parseMatchdayNumber(n);
  const searchQuery = q?.trim() ?? "";
  const data = await getAdminUnifiedVotesData({
    matchdayNumber,
    searchQuery
  });

  const redirectPath = buildUnifiedVotesPath({
    n: data.selectedNumber,
    q: data.searchQuery
  });

  return (
    <AdminShell
      title="Pagelle unificate"
      subtitle="Un solo voto per giocatore, applicato a tutte le leghe in cui ha effettivamente giocato (o e titolare se i punteggi non sono ancora calcolati)."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Giornata selezionata:{" "}
              <strong>
                {data.selectedNumber != null ? data.selectedNumber : "—"}
              </strong>{" "}
              | Leghe: <strong>{data.totals.leagueCount}</strong> | Giocatori:{" "}
              <strong>{data.totals.playerCount}</strong> | Pending:{" "}
              <strong>{data.totals.pendingPlayers}</strong>
            </p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              Salvare un voto lo propaga a tutte le giornate collegate al
              giocatore. &quot;Carica e propaga&quot; genera automaticamente le
              liste voti mancanti su ogni lega della giornata, poi importa il
              file su tutte.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Dashboard
            </Link>
            {data.selectedNumber != null ? (
              <>
                <form action={generateRequiredVotesForUnifiedMatchdayNumberAction}>
                  <input
                    type="hidden"
                    name="matchdayNumber"
                    value={data.selectedNumber}
                  />
                  <input type="hidden" name="redirectPath" value={redirectPath} />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Genera liste voti su tutte le leghe
                  </button>
                </form>
                <form
                  action={importFantacalcioVotesAcrossLeaguesAction}
                  encType="multipart/form-data"
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <input
                    type="hidden"
                    name="matchdayNumber"
                    value={data.selectedNumber}
                  />
                  <input type="hidden" name="redirectPath" value={redirectPath} />
                  <input type="hidden" name="sheetName" value="Fantacalcio" />
                  <label className="text-sm font-medium text-slate-700">
                    Import XLS multi-lega
                    <input
                      type="file"
                      name="votesFile"
                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      required
                      className="mt-1 block w-full max-w-xs text-sm text-slate-600"
                    />
                  </label>
                  <PendingSubmitButton
                    pendingLabel="Import in corso…"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Carica e propaga
                  </PendingSubmitButton>
                </form>
                {showPlatform ? (
                  <>
                    <form action={calculateAllScoresAndResultsAction}>
                      <input
                        type="hidden"
                        name="matchdayNumber"
                        value={data.selectedNumber}
                      />
                      <input type="hidden" name="redirectPath" value={redirectPath} />
                      <PendingSubmitButton
                        pendingLabel="Calcolo in corso…"
                        className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Calcola punteggi e risultati
                      </PendingSubmitButton>
                    </form>
                    <form action={publishAllMatchdaysAction}>
                      <input
                        type="hidden"
                        name="matchdayNumber"
                        value={data.selectedNumber}
                      />
                      <input type="hidden" name="redirectPath" value={redirectPath} />
                      <PendingSubmitButton
                        pendingLabel="Pubblicazione in corso…"
                        className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 transition hover:border-indigo-400 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Pubblica giornate
                      </PendingSubmitButton>
                    </form>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {data.availableNumbers.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {data.availableNumbers.map((number) => (
              <Link
                key={number}
                href={buildUnifiedVotesPath({ n: number, q: data.searchQuery })}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  data.selectedNumber === number
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
                }`}
              >
                Giornata {number}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Nessuna giornata in stato voti (lineup chiuse o successive).
          </p>
        )}

        {data.matchdays.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {data.matchdays.map((matchday) => (
              <Link
                key={matchday.id}
                href={`/admin/matchdays/${matchday.id}/votes`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:border-slate-300"
              >
                <span className="font-medium">{matchday.leagueName}</span>
                <StatusBadge status={matchday.status} />
              </Link>
            ))}
          </div>
        ) : null}

        <form className="mt-5 flex flex-wrap gap-3">
          {data.selectedNumber != null ? (
            <input type="hidden" name="n" value={data.selectedNumber} />
          ) : null}
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
              href={buildUnifiedVotesPath({ n: data.selectedNumber })}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Reset
            </Link>
          ) : null}
        </form>
      </section>

      {data.players.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {data.searchQuery
            ? `Nessun giocatore trovato per "${data.searchQuery}".`
            : "Nessun giocatore da votare per questa giornata. Chiudi le formazioni e genera le liste voti."}
        </section>
      ) : (
        <form action={saveBulkUnifiedPlayerVotesAction} className="space-y-4">
          <input type="hidden" name="redirectPath" value={redirectPath} />
          {data.selectedNumber != null ? (
            <input
              type="hidden"
              name="matchdayNumber"
              value={data.selectedNumber}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Giocatori in elenco: <strong>{data.players.length}</strong>
            </p>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Salva tutti (multi-lega)
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1280px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Giocatore</th>
                  <th className="px-3 py-3 font-medium">Ruolo</th>
                  <th className="px-3 py-3 font-medium">Leghe</th>
                  <th className="px-3 py-3 font-medium">Voto base</th>
                  <th className="px-3 py-3 font-medium">Gol</th>
                  <th className="px-3 py-3 font-medium">Gs</th>
                  <th className="px-3 py-3 font-medium">Assist</th>
                  <th className="px-3 py-3 font-medium">Gialli</th>
                  <th className="px-3 py-3 font-medium">Rossi</th>
                  <th className="px-3 py-3 font-medium">SV</th>
                  <th className="px-3 py-3 font-medium">Note / extra</th>
                  <th className="px-3 py-3 font-medium">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.players.map((record) => {
                  const saveSingleAction = saveSingleUnifiedPlayerVoteAction.bind(
                    null,
                    record.player.id
                  );
                  const formVote = record.formVote;

                  return (
                    <tr
                      key={record.player.id}
                      className={
                        record.pendingAppearances > 0
                          ? "bg-amber-50/30"
                          : "bg-white"
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
                        {record.matchdayIds.map((matchdayId) => (
                          <input
                            key={matchdayId}
                            type="hidden"
                            name={`playerMatchdayIds.${record.player.id}`}
                            value={matchdayId}
                          />
                        ))}
                        <div className="min-w-[220px]">
                          <p className="font-medium">{record.player.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {record.player.teamName ?? "Team n/d"} | Pending:{" "}
                            {record.pendingAppearances}/{record.appearances.length}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            FV: {formVote?.finalFantavote ?? "—"}
                          </p>
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
                        <div className="max-w-[220px] space-y-1 text-xs text-slate-600">
                          {record.appearances.map((appearance) => (
                            <p key={`${appearance.matchdayId}-${appearance.source}`}>
                              {appearance.leagueName}{" "}
                              <span className="text-slate-400">
                                ({appearance.source.replaceAll("_", " ")})
                              </span>
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "baseVote")}
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          defaultValue={formVote?.baseVote ?? ""}
                          className="w-24 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "goals")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={formVote?.goals ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "goalsConceded")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={formVote?.goalsConceded ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "assists")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={formVote?.assists ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "yellowCards")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={formVote?.yellowCards ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          name={getVoteFieldName(record.player.id, "redCards")}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={formVote?.redCards ?? 0}
                          className="w-20 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            name={getVoteFieldName(record.player.id, "isSv")}
                            type="checkbox"
                            defaultChecked={formVote?.isSv ?? false}
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
                            defaultValue={formVote?.notes ?? ""}
                            className="min-w-[220px] rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              name={getVoteFieldName(record.player.id, "ownGoals")}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={formVote?.ownGoals ?? 0}
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
                              defaultValue={formVote?.penaltiesSaved ?? 0}
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
                              defaultValue={formVote?.penaltiesMissed ?? 0}
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
                              defaultValue={formVote?.penaltiesScored ?? 0}
                              placeholder="Rf"
                              title="Rigori realizzati (+3)"
                              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
                            />
                            <input
                              name={getVoteFieldName(record.player.id, "cleanSheet")}
                              type="number"
                              min="0"
                              max="1"
                              step="1"
                              defaultValue={formVote?.cleanSheet ?? 0}
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
              Salva tutti (multi-lega)
            </button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
