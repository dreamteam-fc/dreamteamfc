import Link from "next/link";
import { notFound } from "next/navigation";

import {
  calculateTournamentRoundFromVotesAction,
  generateTournamentRoundRequiredVotesAction,
  importTournamentRoundVotesAction,
  recordTournamentFixtureResultAction,
  setTournamentLineupsOpenAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { isRequiredVoteCompletedStatus } from "@/lib/server/votes/shared";
import { getTournamentBracketPageData } from "@/lib/server/tournaments/generate-tournament-bracket";

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

export default async function TournamentBracketPage({
  params,
  searchParams
}: BracketPageProps) {
  const { tournamentId } = await params;
  const { error, notice } = await searchParams;
  const tournament = await getTournamentBracketPageData(tournamentId);

  if (!tournament) {
    notFound();
  }

  return (
    <AdminShell
      title={`Tabellone — ${tournament.name}`}
      subtitle="Inserisci i risultati delle partite READY. A serie completa il vincitore avanza (pareggio aggregato → seed migliore)."
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
          <strong>
            {tournament.lineupsOpen ? "aperte" : "chiuse"}
          </strong>
        </span>
        <form action={setTournamentLineupsOpenAction}>
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <input
            type="hidden"
            name="lineupsOpen"
            value={tournament.lineupsOpen ? "false" : "true"}
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {tournament.lineupsOpen
              ? "Chiudi formazioni"
              : "Apri formazioni"}
          </button>
        </form>
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

          return (
            <section
              key={round.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-900">
                {round.name}
                {round.isFinal ? " (solo andata)" : " (andata/ritorno)"}
              </h2>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Voti Fantacalcio (XLS)
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Genera la lista dai giocatori in formazione READY, importa il
                  file, poi calcola i gol da fantavoto (stesse fasce del
                  campionato). Puoi ancora inserire i risultati a mano sotto.
                </p>
                {round.requiredVotes.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Lista voti:{" "}
                    {
                      round.requiredVotes.filter((entry) =>
                        isRequiredVoteCompletedStatus(entry.status)
                      ).length
                    }
                    /{round.requiredVotes.length} pronti ·{" "}
                    {round._count.playerVotes} voti salvati
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Lista voti non ancora generata per questa fase.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-3">
                  <form action={generateTournamentRoundRequiredVotesAction}>
                    <input
                      type="hidden"
                      name="tournamentId"
                      value={tournament.id}
                    />
                    <input type="hidden" name="roundId" value={round.id} />
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
                    <input
                      type="hidden"
                      name="tournamentId"
                      value={tournament.id}
                    />
                    <input type="hidden" name="roundId" value={round.id} />
                    <label className="space-y-1 text-xs text-slate-600">
                      <span>File XLS</span>
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
                      Importa XLS
                    </button>
                  </form>
                  <form action={calculateTournamentRoundFromVotesAction}>
                    <input
                      type="hidden"
                      name="tournamentId"
                      value={tournament.id}
                    />
                    <input type="hidden" name="roundId" value={round.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                    >
                      Calcola partite da voti
                    </button>
                  </form>
                </div>
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
