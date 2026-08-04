import Link from "next/link";
import {
  RequiredVoteStatus,
  TournamentRoundLineupsStatus
} from "@prisma/client";
import { notFound } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import {
  calculateTournamentRoundFromVotesAction,
  generateRandomTournamentLineupsForRoundAction,
  generateTournamentRoundRequiredVotesAction,
  importTournamentRoundVotesAction,
  lockTournamentRoundLineupsAction,
  openTournamentRoundLineupsAction,
  recordTournamentFixtureResultAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { isRequiredVoteCompletedStatus } from "@/lib/server/votes/shared";
import { getTournamentBracketPageData } from "@/lib/server/tournaments/generate-tournament-bracket";
import { getNextUsefulTournamentRound } from "@/lib/server/tournaments/next-useful-tournament-round";

export const dynamic = "force-dynamic";

type BracketPageProps = {
  params: Promise<{
    tournamentId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    notice?: string;
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

function teamLabel(
  team: { id: string; name: string } | null | undefined
): string {
  return team?.name ?? "Da definire";
}

function lineupsStatusLabel(status: TournamentRoundLineupsStatus): string {
  switch (status) {
    case TournamentRoundLineupsStatus.OPEN:
      return "Formazioni aperte";
    case TournamentRoundLineupsStatus.LOCKED:
      return "Formazioni chiuse";
    default:
      return "Formazioni non aperte";
  }
}

function VoteLegActions({
  isFinal,
  leg,
  legLabel,
  readyPlayableCount,
  requiredVotes,
  savedVotesCount,
  tournamentId,
  roundId
}: {
  isFinal: boolean;
  leg: 1 | 2;
  legLabel: string;
  readyPlayableCount: number;
  requiredVotes: Array<{ status: RequiredVoteStatus }>;
  savedVotesCount: number;
  tournamentId: string;
  roundId: string;
}) {
  const completedVotes = requiredVotes.filter((entry) =>
    isRequiredVoteCompletedStatus(entry.status)
  ).length;
  const hasVoteList = requiredVotes.length > 0;
  const votesReady = hasVoteList && completedVotes === requiredVotes.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">
        {isFinal ? "Voti (unica gara)" : legLabel}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <form action={generateTournamentRoundRequiredVotesAction}>
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="leg" value={String(leg)} />
          <button
            type="submit"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
          >
            Genera lista voti
          </button>
        </form>
        <form
          action={importTournamentRoundVotesAction}
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="leg" value={String(leg)} />
          <label className="space-y-1 text-xs text-slate-600">
            <span>File XLS {isFinal ? "" : `(${legLabel})`}</span>
            <input
              type="file"
              name="votesFile"
              accept=".xls,.xlsx"
              required
              className="block text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Foglio</span>
            <input
              type="text"
              name="sheetName"
              defaultValue="Fantacalcio"
              className="w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Carica XLS
          </button>
        </form>
        <form action={calculateTournamentRoundFromVotesAction}>
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="leg" value={String(leg)} />
          <button
            type="submit"
            disabled={!votesReady || readyPlayableCount === 0}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Calcola {isFinal ? "partite" : legLabel.toLowerCase()}
          </button>
        </form>
      </div>
      {hasVoteList ? (
        <p className="mt-2 text-xs text-slate-500">
          Lista voti: {completedVotes}/{requiredVotes.length} pronti ·{" "}
          {savedVotesCount} voti salvati
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Lista voti non ancora generata
          {isFinal ? "." : ` per ${legLabel.toLowerCase()}.`}
        </p>
      )}
    </div>
  );
}

export default async function TournamentBracketPage({
  params,
  searchParams
}: BracketPageProps) {
  await requireAdminAccess();
  const { tournamentId } = await params;
  const { error, notice } = await searchParams;
  const tournament = await getTournamentBracketPageData(tournamentId);

  if (!tournament) {
    notFound();
  }

  const nextUsefulRound = getNextUsefulTournamentRound(tournament.rounds);
  const openRound =
    tournament.rounds.find(
      (round) => round.lineupsStatus === TournamentRoundLineupsStatus.OPEN
    ) ?? null;
  // Prefer OPEN phase for admin Genera/Chiudi; fall back to next useful READY round.
  const lineupActionRound = openRound ?? nextUsefulRound;

  return (
    <AdminShell
      title={`Tabellone — ${tournament.name}`}
      subtitle="Flusso per fase (come le giornate di lega): Apri formazioni → Chiudi → Genera liste → Carica XLS → Calcola. A serie completa il vincitore avanza."
    >
      <Feedback error={error} notice={notice} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/tournaments"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Torna ai tornei
        </Link>
        <Link
          href={`/admin/tournaments/${tournament.id}/entries`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Roster
        </Link>
        <Link
          href={`/tournaments/${tournament.id}`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Vista pubblica
        </Link>
        <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Stato: <strong>{tournament.status}</strong>
        </span>
        <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Formazioni:{" "}
          <strong>{openRound ? "aperte" : "chiuse"}</strong>
          {openRound ? ` (${openRound.name})` : null}
        </span>
        {lineupActionRound ? (
          <form action={generateRandomTournamentLineupsForRoundAction}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="roundId" value={lineupActionRound.id} />
            <PendingSubmitButton
              pendingLabel="Generazione formazioni…"
              className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 transition hover:border-orange-400 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Genera formazioni ({lineupActionRound.name})
            </PendingSubmitButton>
          </form>
        ) : null}
        {openRound ? (
          <form action={lockTournamentRoundLineupsAction}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="roundId" value={openRound.id} />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Chiudi formazioni
            </button>
          </form>
        ) : null}
      </div>

      {tournament.entries.some((entry) => entry.seedRank != null) ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Seeding</h2>
          <ol className="mt-4 space-y-2 text-sm text-slate-700">
            {tournament.entries.map((entry) => (
              <li key={entry.fantasyTeamId}>
                <strong>#{entry.seedRank ?? "-"}</strong>{" "}
                {entry.fantasyTeam.name} ({entry.sourceLeague.name}) —{" "}
                {entry.seedPoints} pt
                {entry.activatedAt ? (
                  <span className="ml-2 text-emerald-700">· attivata</span>
                ) : (
                  <span className="ml-2 text-amber-700">· non attivata</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {tournament.rounds.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Tabellone non ancora generato. Salva il roster e poi genera il
          tabellone dalla pagina squadre.
        </section>
      ) : (
        tournament.rounds.map((round) => {
          const seriesMap = new Map<
            string,
            (typeof round.fixtures)[number][]
          >();

          for (const fixture of round.fixtures) {
            const list = seriesMap.get(fixture.seriesKey) ?? [];
            list.push(fixture);
            seriesMap.set(fixture.seriesKey, list);
          }

          const series = Array.from(seriesMap.entries()).sort((left, right) => {
            return left[1][0].bracketSlot - right[1][0].bracketSlot;
          });

          const readyPlayableCount = round.fixtures.filter(
            (fixture) =>
              fixture.status === "READY" &&
              fixture.homeTeam &&
              fixture.awayTeam
          ).length;
          const readyByLeg = {
            1: round.fixtures.filter(
              (fixture) =>
                fixture.leg === 1 &&
                fixture.status === "READY" &&
                fixture.homeTeam &&
                fixture.awayTeam
            ).length,
            2: round.fixtures.filter(
              (fixture) =>
                fixture.leg === 2 &&
                fixture.status === "READY" &&
                fixture.homeTeam &&
                fixture.awayTeam
            ).length
          };
          const requiredByLeg = {
            1: round.requiredVotes.filter((entry) => entry.leg === 1),
            2: round.requiredVotes.filter((entry) => entry.leg === 2)
          };
          const savedByLeg = {
            1: round.playerVotes.filter((entry) => entry.leg === 1).length,
            2: round.playerVotes.filter((entry) => entry.leg === 2).length
          };
          const voteLegs: Array<1 | 2> = round.isFinal ? [1] : [1, 2];

          return (
            <section
              key={round.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {round.name}
                    {round.isFinal ? " (solo andata)" : " (andata/ritorno)"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Formazioni:{" "}
                    <strong>{lineupsStatusLabel(round.lineupsStatus)}</strong>
                    {readyPlayableCount > 0
                      ? ` · ${readyPlayableCount} partite READY`
                      : " · nessuna partita READY"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Azioni fase (ordine lega)
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  1. Apri formazioni → 2. utenti schierano → 3. Chiudi → 4.
                  Genera liste (per gamba) → 5. Carica XLS (per gamba) → 6.
                  Calcola (per gamba)
                </p>

                <div className="mt-3 flex flex-wrap gap-3">
                  {round.lineupsStatus === TournamentRoundLineupsStatus.DRAFT &&
                  readyPlayableCount > 0 ? (
                    <form action={openTournamentRoundLineupsAction}>
                      <input
                        type="hidden"
                        name="tournamentId"
                        value={tournament.id}
                      />
                      <input type="hidden" name="roundId" value={round.id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      >
                        Apri formazioni
                      </button>
                    </form>
                  ) : null}

                  {round.lineupsStatus ===
                  TournamentRoundLineupsStatus.OPEN ? (
                    <>
                      <form
                        action={generateRandomTournamentLineupsForRoundAction}
                      >
                        <input
                          type="hidden"
                          name="tournamentId"
                          value={tournament.id}
                        />
                        <input type="hidden" name="roundId" value={round.id} />
                        <PendingSubmitButton
                          pendingLabel="Generazione formazioni…"
                          className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-900 transition hover:border-orange-400 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Schiera formazioni (tutte le squadre)
                        </PendingSubmitButton>
                      </form>
                      <form action={lockTournamentRoundLineupsAction}>
                        <input
                          type="hidden"
                          name="tournamentId"
                          value={tournament.id}
                        />
                        <input type="hidden" name="roundId" value={round.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
                        >
                          Chiudi formazioni
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>

                {round.lineupsStatus ===
                TournamentRoundLineupsStatus.LOCKED ? (
                  <div className="mt-3 space-y-3">
                    {voteLegs.map((leg) => (
                      <VoteLegActions
                        key={`${round.id}-leg-${leg}`}
                        isFinal={round.isFinal}
                        leg={leg}
                        legLabel={leg === 1 ? "Andata" : "Ritorno"}
                        readyPlayableCount={readyByLeg[leg]}
                        requiredVotes={requiredByLeg[leg]}
                        savedVotesCount={savedByLeg[leg]}
                        tournamentId={tournament.id}
                        roundId={round.id}
                      />
                    ))}
                  </div>
                ) : null}

                {round.lineupsStatus === TournamentRoundLineupsStatus.DRAFT &&
                readyPlayableCount === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Attendi che le partite diventino READY (squadre definite)
                    prima di aprire le formazioni.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                {series.map(([seriesKey, fixtures]) => {
                  const first = fixtures[0];
                  return (
                    <article
                      key={seriesKey}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-sm font-semibold text-slate-500">
                        Serie #{first.bracketSlot + 1}
                      </p>
                      <div className="mt-3 space-y-3 text-sm text-slate-700">
                        {fixtures.map((fixture) => (
                          <div
                            key={fixture.id}
                            className="space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {round.isFinal
                                  ? "Partita"
                                  : fixture.leg === 1
                                    ? "Andata"
                                    : "Ritorno"}
                                :{" "}
                                <strong>{teamLabel(fixture.homeTeam)}</strong>{" "}
                                vs{" "}
                                <strong>{teamLabel(fixture.awayTeam)}</strong>
                              </span>
                              <span className="text-slate-500">
                                {fixture.homeGoals != null &&
                                fixture.awayGoals != null
                                  ? `${fixture.homeGoals} - ${fixture.awayGoals}`
                                  : fixture.status}
                              </span>
                            </div>
                            {fixture.homeTeam || fixture.awayTeam ? (
                              <p className="text-xs text-slate-500">
                                Formazioni:{" "}
                                {fixture.homeTeam
                                  ? `${fixture.homeTeam.name} ${
                                      fixture.lineups.some(
                                        (lineup) =>
                                          lineup.fantasyTeamId ===
                                          fixture.homeTeamId
                                      )
                                        ? "✓"
                                        : "—"
                                    }`
                                  : null}
                                {fixture.homeTeam && fixture.awayTeam
                                  ? " · "
                                  : null}
                                {fixture.awayTeam
                                  ? `${fixture.awayTeam.name} ${
                                      fixture.lineups.some(
                                        (lineup) =>
                                          lineup.fantasyTeamId ===
                                          fixture.awayTeamId
                                      )
                                        ? "✓"
                                        : "—"
                                    }`
                                  : null}
                              </p>
                            ) : null}

                            {fixture.status === "READY" &&
                            fixture.homeTeam &&
                            fixture.awayTeam ? (
                              <form
                                action={recordTournamentFixtureResultAction}
                                className="flex flex-wrap items-end gap-3"
                              >
                                <input
                                  type="hidden"
                                  name="fixtureId"
                                  value={fixture.id}
                                />
                                <input
                                  type="hidden"
                                  name="tournamentId"
                                  value={tournament.id}
                                />
                                <label className="space-y-1 text-xs text-slate-600">
                                  <span>
                                    Gol {fixture.homeTeam.name} (casa)
                                  </span>
                                  <input
                                    type="number"
                                    name="homeGoals"
                                    min={0}
                                    required
                                    className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <span>
                                    Gol {fixture.awayTeam.name} (trasferta)
                                  </span>
                                  <input
                                    type="number"
                                    name="awayGoals"
                                    min={0}
                                    required
                                    className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                  />
                                </label>
                                <button
                                  type="submit"
                                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                                >
                                  Salva risultato
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </AdminShell>
  );
}
