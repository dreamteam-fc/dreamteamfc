import Link from "next/link";

import { TeamLogo } from "@/components/teams/team-logo";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import { getUserDashboardData } from "@/lib/server/me/read-user-data";
import { getUserTournamentFixtures } from "@/lib/server/tournaments/read-user-tournament-data";

export const dynamic = "force-dynamic";

type MePageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

function Feedback({ notice }: { notice?: string }) {
  if (!notice) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {notice}
    </div>
  );
}

export default async function MePage({ searchParams }: MePageProps) {
  const { notice } = await searchParams;
  const authContext = await requireAuthenticatedAppUser("/me");
  const [data, tournamentFixtures] = await Promise.all([
    getUserDashboardData(authContext.appUser.id),
    getUserTournamentFixtures(authContext.appUser.id)
  ]);

  if (!data) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        Impossibile caricare il profilo utente applicativo.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Feedback notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Profilo</h2>
            <p className="mt-2 text-sm text-slate-600">
              Nome: <strong>{data.user.displayName ?? "Non disponibile"}</strong>{" "}
              | Email: <strong>{data.user.email}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/come-giocare"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Come giocare
            </Link>
            <Link
              href="/regolamento"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Regolamento
            </Link>
            <Link
              href="/tournaments"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Tornei
            </Link>
            <Link
              href="/leagues"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Leghe disponibili
            </Link>
          </div>
        </div>
      </section>

      {tournamentFixtures.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Partite torneo da schierare
            </h2>
            <Link
              href="/tournaments"
              className="text-sm font-semibold text-brand-blue"
            >
              Tutti i tornei
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {tournamentFixtures.map((fixture) => {
              const opponent =
                fixture.homeTeam?.id === fixture.myTeamId
                  ? fixture.awayTeam
                  : fixture.homeTeam;
              const matchLabel = fixture.isFinal
                ? "Finale"
                : fixture.leg === 1
                  ? "Andata"
                  : "Ritorno";

              return (
                <article
                  key={`${fixture.fixtureId}-${fixture.myTeamId}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {fixture.tournamentName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {fixture.myTeamName} · {fixture.roundName} ({matchLabel})
                      vs {opponent?.name ?? "Da definire"}
                      {fixture.hasLineup ? " · formazione inserita" : ""}
                      {!fixture.activated ? " · accesso non sbloccato" : ""}
                    </p>
                  </div>
                  {fixture.activated ? (
                    <Link
                      href={`/me/teams/${fixture.myTeamId}/tournaments/fixtures/${fixture.fixtureId}/lineup`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      {fixture.hasLineup
                        ? "Modifica formazione"
                        : "Schiera formazione"}
                    </Link>
                  ) : fixture.isOwner ? (
                    <Link
                      href={`/tournaments/${fixture.tournamentId}/activate`}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500"
                    >
                      Sblocca accesso
                    </Link>
                  ) : (
                    <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                      In attesa sblocco proprietario
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Le mie squadre</h2>
        {data.myTeams.length > 0 ? (
          <div className="mt-4 space-y-4">
            {data.myTeams.map((team) => (
              <div
                key={team.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamLogo
                      alt={`Logo ${team.name}`}
                      cacheBust={team.updatedAt}
                      logoPath={team.logoPath}
                      size="sm"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {team.name}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Lega: <strong>{team.league.name}</strong>
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/me/teams/${team.id}`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Apri squadra
                  </Link>
                </div>

                {team.openMatchdays.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Giornate aperte
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {team.openMatchdays.map((matchday) => (
                        <Link
                          key={matchday.id}
                          href={`/me/teams/${team.id}/matchdays/${matchday.id}/lineup`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Giornata #{matchday.number}
                          {matchday.hasLineup ? " | Formazione inserita" : ""}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Entra in una lega per creare la tua prima squadra.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Squadre come allenatore
        </h2>
        {data.coachedTeams.length > 0 ? (
          <div className="mt-4 space-y-4">
            {data.coachedTeams.map((team) => (
              <div
                key={team.id}
                className="space-y-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamLogo
                      alt={`Logo ${team.name}`}
                      cacheBust={team.updatedAt}
                      logoPath={team.logoPath}
                      size="sm"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {team.name}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Lega: <strong>{team.league.name}</strong> | Proprietario:{" "}
                        <strong>
                          {team.owner.displayName ?? team.owner.email}
                        </strong>
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-cyan-800">
                        Solo formazioni
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/me/teams/${team.id}`}
                    className="btn-brand"
                  >
                    Apri squadra
                  </Link>
                </div>

                {team.openMatchdays.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Giornate aperte
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {team.openMatchdays.map((matchday) => (
                        <Link
                          key={matchday.id}
                          href={`/me/teams/${team.id}/matchdays/${matchday.id}/lineup`}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                          Giornata #{matchday.number}
                          {matchday.hasLineup ? " | Formazione inserita" : ""}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Nessuna giornata con formazioni aperte.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Non stai allenando nessuna squadra. Quando ricevi un invito, aprilo
            da loggato con la stessa email.
          </p>
        )}
      </section>

      {data.leagues.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Entra in una lega per creare la tua squadra.
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Le mie leghe</h2>
          <div className="mt-5 space-y-4">
            {data.leagues.map((league) => (
              <article
                key={league.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {league.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Membership:{" "}
                      <strong>{league.membershipRole ?? "Nessuna"}</strong> |
                      Squadra: <strong>{league.myTeam?.name ?? "-"}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/leagues/${league.id}`}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Apri lega
                    </Link>
                    {league.myTeam ? (
                      <Link
                        href={`/me/teams/${league.myTeam.id}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      >
                        La mia squadra
                      </Link>
                    ) : (
                      <span className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500">
                        Nessuna squadra
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
