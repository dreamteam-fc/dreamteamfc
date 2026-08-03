import Link from "next/link";
import { notFound } from "next/navigation";

import {
  generateLeagueScheduleAction,
  lockLineupsAction,
  openLineupsAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminLeagueScheduleData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type AdminLeagueSchedulePageProps = {
  params: Promise<{
    leagueId: string;
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

function getRestTeams(
  allTeams: Array<{ id: string; name: string }>,
  fixtures: Array<{
    awayTeam: { id: string; name: string };
    homeTeam: { id: string; name: string };
  }>
) {
  const scheduledTeamIds = new Set(
    fixtures.flatMap((fixture) => [fixture.homeTeam.id, fixture.awayTeam.id])
  );

  return allTeams.filter((team) => !scheduledTeamIds.has(team.id));
}

function ActionForm({
  action,
  children
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return <form action={action}>{children}</form>;
}

export default async function AdminLeagueSchedulePage({
  params,
  searchParams
}: AdminLeagueSchedulePageProps) {
  const { leagueId } = await params;
  const { error, notice } = await searchParams;
  const data = await getAdminLeagueScheduleData(leagueId);

  if (!data) {
    notFound();
  }

  const canGenerateSchedule =
    data.previews.teamCount >= 2 && !data.hasExistingSchedule;

  return (
    <AdminShell
      title="Calendario campionato"
      subtitle={`Genera il calendario round-robin per la lega ${data.league.name}.`}
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Lega: <strong>{data.league.name}</strong> | Squadre iscritte:{" "}
          <strong>{data.previews.teamCount}</strong> /{" "}
          <strong>{data.league.maxTeams}</strong> | Giornate esistenti:{" "}
          <strong>{data.league._count.matchdays}</strong> | Fixture esistenti:{" "}
          <strong>{data.existingFixtureCount}</strong>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/admin/leagues/${data.league.id}/players`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Gestisci giocatori lega
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Anteprima</h2>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Andata e ritorno (obbligatorio)
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Con 10 squadre:{" "}
            <strong>{data.previews.doubleRoundMatchdayCount}</strong> giornate |{" "}
            <strong>{data.previews.doubleRoundFixtureCount}</strong> partite.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Squadre iscritte ora: <strong>{data.previews.teamCount}</strong> / 10
          </p>
        </div>

        {data.previews.hasBye ? (
          <p className="mt-4 text-sm text-amber-700">
            Ogni giornata una squadra riposa.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Generazione</h2>

        {data.previews.teamCount !== 10 ? (
          <p className="mt-4 text-sm text-amber-700">
            Servono esattamente 10 squadre per generare il calendario (ora:{" "}
            {data.previews.teamCount}).
          </p>
        ) : null}

        {data.hasExistingSchedule ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Calendario già generato o giornate già presenti.
          </div>
        ) : null}

        <form action={generateLeagueScheduleAction} className="mt-5 space-y-4">
          <input type="hidden" name="leagueId" value={data.league.id} />

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canGenerateSchedule || data.previews.teamCount !== 10}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Genera calendario andata/ritorno
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Torna alla dashboard
            </Link>
          </div>
        </form>
      </section>

      {data.hasExistingSchedule ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Giornate esistenti
          </h2>

          {data.league.matchdays.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Nessuna giornata disponibile.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {data.league.matchdays.map((matchday) => (
                <article
                  key={matchday.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Giornata {matchday.number}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span>
                          Fixture: <strong>{matchday._count.fixtures}</strong>
                        </span>
                        {matchday.status === "LINEUPS_OPEN" ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                            Formazioni aperte
                          </span>
                        ) : (
                          <StatusBadge status={matchday.status} />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {matchday.status === "DRAFT" ? (
                        <ActionForm action={openLineupsAction.bind(null, matchday.id)}>
                          <button
                            type="submit"
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                          >
                            Apri formazioni
                          </button>
                        </ActionForm>
                      ) : null}

                      {matchday.status === "LINEUPS_OPEN" ? (
                        <ActionForm action={lockLineupsAction.bind(null, matchday.id)}>
                          <button
                            type="submit"
                            className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400 hover:bg-rose-100"
                          >
                            Chiudi formazioni
                          </button>
                        </ActionForm>
                      ) : null}

                      <Link
                        href={`/admin/matchdays/${matchday.id}`}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                      >
                        Dettaglio giornata
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    {matchday.fixtures.length === 0 ? (
                      <p>Nessuno scontro disponibile per questa giornata.</p>
                    ) : (
                      matchday.fixtures.map((fixture) => (
                        <p key={fixture.id}>
                          <strong>{fixture.homeTeam.name}</strong> vs{" "}
                          <strong>{fixture.awayTeam.name}</strong>
                        </p>
                      ))
                    )}

                    {(() => {
                      const restTeams = getRestTeams(
                        data.league.fantasyTeams,
                        matchday.fixtures
                      );

                      if (restTeams.length === 0) {
                        return null;
                      }

                      if (restTeams.length === 1) {
                        return (
                          <p className="text-amber-700">
                            Squadra a riposo: <strong>{restTeams[0].name}</strong>
                          </p>
                        );
                      }

                      return (
                        <p className="text-amber-700">
                          Riposo/non abbinate:{" "}
                          <strong>
                            {restTeams.map((team) => team.name).join(", ")}
                          </strong>
                        </p>
                      );
                    })()}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </AdminShell>
  );
}
