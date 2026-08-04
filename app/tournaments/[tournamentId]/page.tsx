import Link from "next/link";
import { notFound } from "next/navigation";

import { getTournamentBracketPageData } from "@/lib/server/tournaments/generate-tournament-bracket";

export const dynamic = "force-dynamic";

type TournamentPageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

function teamLabel(team: { name: string } | null | undefined) {
  return team?.name ?? "Da definire";
}

export default async function TournamentPublicPage({
  params,
  searchParams
}: TournamentPageProps) {
  const { tournamentId } = await params;
  const { notice } = await searchParams;
  const tournament = await getTournamentBracketPageData(tournamentId);

  if (!tournament) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-3xl bg-brand-void text-white shadow-brand">
          <div className="brand-spectrum-bar" />
          <div className="bg-brand-aurora px-6 py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-mute">
              Torneo
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide">
              {tournament.name}
            </h1>
            <p className="mt-3 text-sm text-brand-mute">
              Stato: {tournament.status}
              {tournament.rounds.some(
                (round) =>
                  round.lineupsStatusLeg1 === "OPEN" ||
                  round.lineupsStatusLeg2 === "OPEN"
              )
                ? " · Formazioni aperte (giornata attiva)"
                : " · Nessuna giornata con formazioni aperte"}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/tournaments/${tournament.id}/activate`}
                className="rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-void"
              >
                Sblocca accesso
              </Link>
              <Link href="/tournaments" className="btn-brand-secondary">
                Tutti i tornei
              </Link>
              <Link href="/me" className="btn-brand-secondary">
                Area utente
              </Link>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {tournament.rounds.length === 0 ? (
          <section className="surface-card p-6 text-sm text-slate-600">
            Tabellone non ancora generato.
          </section>
        ) : (
          tournament.rounds.map((round) => {
            const seriesMap = new Map<string, (typeof round.fixtures)[number][]>();
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
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-brand-ink">
                  {round.name}
                </h2>
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
                            className="flex flex-wrap justify-between gap-2 rounded-xl bg-white px-3 py-2"
                          >
                            <span>
                              {round.isFinal
                                ? "Partita"
                                : fixture.leg === 1
                                  ? "Andata"
                                  : "Ritorno"}
                              : <strong>{teamLabel(fixture.homeTeam)}</strong> vs{" "}
                              <strong>{teamLabel(fixture.awayTeam)}</strong>
                            </span>
                            <span className="text-slate-500">
                              {fixture.homeGoals != null &&
                              fixture.awayGoals != null
                                ? `${fixture.homeGoals}-${fixture.awayGoals}`
                                : fixture.status}
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
