import { SlotType } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveTournamentLineupAction } from "@/app/me/actions";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import { getPlayerRoleLabel } from "@/lib/players/player-role";
import { getTournamentLineupPageData } from "@/lib/server/tournaments/read-user-tournament-data";

export const dynamic = "force-dynamic";

type LineupPageProps = {
  params: Promise<{
    fixtureId: string;
    teamId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    notice?: string;
  }>;
};

type ExistingLineupSelection = {
  selection: "BENCH" | "NONE" | "STARTER";
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

function getExistingLineupSelectionMap(
  players:
    | Array<{
        playerId: string;
        positionOrder: number;
        slotType: SlotType;
      }>
    | undefined
) {
  const selections = new Map<string, ExistingLineupSelection>();

  for (const player of players ?? []) {
    selections.set(player.playerId, {
      selection: player.slotType
    });
  }

  return selections;
}

function LineupSummary({
  validation
}: {
  validation:
    | {
        attackerStarterCount: number;
        benchCount: number;
        defenderStarterCount: number;
        errors: string[];
        goalkeeperStarterCount: number;
        isValid: boolean;
        midfielderStarterCount: number;
        starterCount: number;
      }
    | null;
}) {
  if (!validation) {
    return (
      <p className="mt-2 text-sm text-slate-600">
        Nessuna formazione inserita per questa partita.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-slate-600">
        Titolari: <strong>{validation.starterCount}</strong> | Panchina:{" "}
        <strong>{validation.benchCount}</strong> | Portieri titolari:{" "}
        <strong>{validation.goalkeeperStarterCount}</strong> | Difensori titolari:{" "}
        <strong>{validation.defenderStarterCount}</strong> | Centrocampisti titolari:{" "}
        <strong>{validation.midfielderStarterCount}</strong> | Attaccanti titolari:{" "}
        <strong>{validation.attackerStarterCount}</strong>
      </p>

      {validation.errors.length > 0 ? (
        <ul className="space-y-2 text-sm text-rose-700">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-emerald-700">Formazione valida.</p>
      )}
    </div>
  );
}

export default async function TournamentFixtureLineupPage({
  params,
  searchParams
}: LineupPageProps) {
  const { fixtureId, teamId } = await params;
  const { error, notice } = await searchParams;
  const authContext = await requireAuthenticatedAppUser(
    `/me/teams/${teamId}/tournaments/fixtures/${fixtureId}/lineup`
  );
  const data = await getTournamentLineupPageData(
    teamId,
    fixtureId,
    authContext
  );

  if (!data) {
    notFound();
  }

  if (data.accessDenied) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
        Accesso non autorizzato.
      </section>
    );
  }

  const existingSelections = getExistingLineupSelectionMap(
    data.existingLineup?.players
  );
  const starters =
    data.existingLineup?.players.filter(
      (player) => player.slotType === SlotType.STARTER
    ) ?? [];
  const bench =
    data.existingLineup?.players.filter(
      (player) => player.slotType === SlotType.BENCH
    ) ?? [];
  const opponent =
    data.fixture.homeTeamId === data.team.id
      ? data.fixture.awayTeam
      : data.fixture.homeTeam;
  const matchLabel = data.fixture.round.isFinal
    ? "Finale"
    : data.fixture.leg === 1
      ? "Andata"
      : "Ritorno";

  let lockMessage: string | null = null;
  if (!data.activated) {
    lockMessage =
      "Sblocca prima l'accesso al torneo con la password (solo proprietario).";
  } else if (!data.tournament.lineupsOpen) {
    lockMessage = "Formazioni torneo chiuse.";
  } else if (data.fixture.status !== "READY") {
    lockMessage = "Formazione modificabile solo su partite READY.";
  }

  return (
    <div className="space-y-6">
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Formazione torneo | {data.team.name}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Torneo: <strong>{data.tournament.name}</strong> |{" "}
              {data.fixture.round.name} ({matchLabel}) vs{" "}
              <strong>{opponent?.name ?? "Da definire"}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/tournaments/${data.tournament.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Tabellone
            </Link>
            <Link
              href={`/me/teams/${data.team.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Torna alla squadra
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Stato partita</h3>
        <p className="mt-2 text-sm text-slate-600">
          Stato fixture: <strong>{data.fixture.status}</strong> | Formazioni
          torneo:{" "}
          <strong>
            {data.tournament.lineupsOpen ? "aperte" : "chiuse"}
          </strong>{" "}
          | Accesso:{" "}
          <strong>{data.activated ? "sbloccato" : "non sbloccato"}</strong>
        </p>

        {lockMessage ? (
          <p className="mt-3 text-sm text-amber-700">{lockMessage}</p>
        ) : null}

        {!data.activated ? (
          <Link
            href={`/tournaments/${data.tournament.id}/activate`}
            className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Sblocca accesso torneo
          </Link>
        ) : null}

        {!data.rosterValidation.isValid ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p>Completa prima la rosa.</p>
            <Link
              href={`/me/teams/${data.team.id}/roster`}
              className="mt-3 inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 font-medium text-amber-800 transition hover:border-amber-400"
            >
              Vai alla rosa
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">
          Formazione attuale
        </h3>
        <LineupSummary validation={data.existingLineupValidation} />

        {data.existingLineup ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Titolari
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {starters.map((player) => (
                  <li key={player.id}>
                    {player.positionOrder}. {player.player.name} -{" "}
                    {getPlayerRoleLabel(player.player.role)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Panchina
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {bench.map((player) => (
                  <li key={player.id}>
                    {player.player.name} -{" "}
                    {getPlayerRoleLabel(player.player.role)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Riepilogo rosa</h3>
        <p className="mt-2 text-sm text-slate-600">
          Totale: <strong>{data.rosterValidation.total}</strong> | Portieri:{" "}
          <strong>{data.rosterValidation.goalkeeperCount}</strong> | Difensori:{" "}
          <strong>{data.rosterValidation.defenderCount}</strong> | Centrocampisti:{" "}
          <strong>{data.rosterValidation.midfielderCount}</strong> | Attaccanti:{" "}
          <strong>{data.rosterValidation.attackerCount}</strong>
        </p>

        {data.rosterValidation.errors.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-rose-700">
            {data.rosterValidation.errors.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">
          {data.canEdit ? "Modifica formazione" : "Formazione in sola lettura"}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Seleziona 5 titolari (1P, 1D, 1C, 1A + 1 libero tra D/C/A) e 4 panchinari
          (1 per ruolo). In caso di SV, entra il panchinaro dello stesso ruolo (max 1
          sostituzione per partita).
        </p>

        <form action={saveTournamentLineupAction} className="mt-5 space-y-5">
          <input type="hidden" name="teamId" value={data.team.id} />
          <input
            type="hidden"
            name="tournamentFixtureId"
            value={data.fixture.id}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Giocatore</th>
                  <th className="px-3 py-2 font-medium">Ruolo</th>
                  <th className="px-3 py-2 font-medium">Squadra reale</th>
                  <th className="px-3 py-2 font-medium">Selezione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rosterPlayers.map((player) => {
                  const selection = existingSelections.get(player.id);
                  const isUnavailable =
                    player.isBlockedInLeague || !player.isActive;

                  return (
                    <tr key={player.id}>
                      <td className="px-3 py-2 text-slate-900">
                        {player.name}
                        {isUnavailable ? (
                          <span className="ml-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                            Non disponibile
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {getPlayerRoleLabel(player.role)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {player.teamName ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          name={`playerSelection:${player.id}`}
                          defaultValue={selection?.selection ?? "NONE"}
                          disabled={!data.canEdit}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                        >
                          <option value="NONE">Non selezionato</option>
                          <option value="STARTER">Titolare</option>
                          <option value="BENCH">Panchina</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.canEdit ? (
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Salva formazione torneo
            </button>
          ) : null}
        </form>
      </section>
    </div>
  );
}
