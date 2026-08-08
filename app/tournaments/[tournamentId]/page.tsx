import Link from "next/link";
import { notFound } from "next/navigation";
import { TournamentRoundLineupsStatus } from "@prisma/client";

import { BrandHeader, brandHeaderActionClassName } from "@/components/brand/brand-header";
import { getTournamentBracketPageData } from "@/lib/server/tournaments/generate-tournament-bracket";
import { listPublicTournamentGiornate } from "@/lib/server/public/read-public-tournament-giornata";
import {
  legsForTournamentRound,
  tournamentGiornataLabel
} from "@/lib/server/tournaments/tournament-round-leg";

export const dynamic = "force-dynamic";

type TournamentPageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

function teamLabel(team: { name: string } | null | undefined) {
  return team?.name ?? "Da definire";
}

const LINEUPS_STATUS_LABELS: Record<TournamentRoundLineupsStatus, string> = {
  DRAFT: "Non aperte",
  LOCKED: "Chiuse",
  OPEN: "Aperte"
};

export default async function TournamentPublicPage({
  params,
  searchParams
}: TournamentPageProps) {
  const { tournamentId } = await params;
  const { notice } = await searchParams;
  const [tournament, giornateData] = await Promise.all([
    getTournamentBracketPageData(tournamentId),
    listPublicTournamentGiornate(tournamentId)
  ]);

  if (!tournament) {
    notFound();
  }

  const giornate = giornateData?.giornate ?? [];

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <BrandHeader
          title={tournament.name}
          description={`Stato: ${tournament.status}${
            tournament.rounds.some(
              (round) =>
                round.lineupsStatusLeg1 === "OPEN" ||
                round.lineupsStatusLeg2 === "OPEN"
            )
              ? " · Formazioni aperte (giornata attiva)"
              : " · Nessuna giornata con formazioni aperte"
          }`}
          actions={
            <>
              <Link
                href={`/tournaments/${tournament.id}/activate`}
                className="rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-void transition hover:bg-[#ffd24a]"
              >
                Sblocca accesso
              </Link>
              <Link href="/tournaments" className={brandHeaderActionClassName}>
                Tutti i tornei
              </Link>
            </>
          }
        />

        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {giornate.length > 0 ? (
          <section className="surface-card p-6">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-brand-ink">
              Giornate
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Apri una giornata per vedere scontri, fantapunti e pagelle con
              bonus/malus (anche le giornate già giocate).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {giornate.map((giornata) => (
                <Link
                  key={`${giornata.roundId}-${giornata.leg}`}
                  href={giornata.href}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-brand-blue/40 hover:bg-white"
                >
                  <p className="font-semibold text-brand-ink">
                    {giornata.giornataLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Formazioni: {LINEUPS_STATUS_LABELS[giornata.lineupsStatus]}
                    {giornata.completedFixtures > 0
                      ? ` · ${giornata.completedFixtures} risultati`
                      : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {tournament.rounds.length === 0 ? (
          <section className="surface-card p-6 text-sm text-slate-600">
            Tabellone non ancora generato.
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
            const series = Array.from(seriesMap.entries()).sort(
              (left, right) => left[1][0].bracketSlot - right[1][0].bracketSlot
            );

            return (
              <section key={round.id} className="surface-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-brand-ink">
                    {round.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {legsForTournamentRound(round.isFinal).map((leg) => (
                      <Link
                        key={leg}
                        href={`/tournaments/${tournament.id}/giornate/${round.id}?leg=${leg}`}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
                      >
                        {tournamentGiornataLabel({
                          isFinal: round.isFinal,
                          leg,
                          roundName: round.name
                        })}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {series.map(([seriesKey, fixtures]) => (
                    <article
                      key={seriesKey}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
                    >
                      <p className="font-semibold text-slate-500">
                        Serie #{fixtures[0].bracketSlot + 1}
                      </p>
                      <div className="mt-2 space-y-2">
                        {fixtures.map((fixture) => (
                          <div
                            key={fixture.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
                          >
                            <span>
                              {round.isFinal
                                ? "Partita"
                                : fixture.leg === 1
                                  ? "Andata"
                                  : "Ritorno"}
                              :{" "}
                              <strong>{teamLabel(fixture.homeTeam)}</strong> vs{" "}
                              <strong>{teamLabel(fixture.awayTeam)}</strong>
                            </span>
                            <span className="flex flex-wrap items-center gap-3 text-slate-500">
                              {fixture.homeGoals != null &&
                              fixture.awayGoals != null
                                ? `${fixture.homeGoals}-${fixture.awayGoals}`
                                : fixture.status}
                              <Link
                                href={`/tournaments/${tournament.id}/giornate/${round.id}?leg=${fixture.leg}`}
                                className="font-semibold text-brand-blue"
                              >
                                Pagelle
                              </Link>
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
