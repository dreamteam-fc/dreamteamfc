import { MatchdayStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  calculateFantasyFixtureResultsAction,
  calculateMatchdayScoresAction,
  generateFantasyFixturesAction,
  generateRequiredVotePlayersAction,
  lockLineupsAction,
  openLineupsAction,
  publishMatchdayAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminMatchdayDetailData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type AdminMatchdayDetailPageProps = {
  params: Promise<{
    matchdayId: string;
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

function canShowPostLineupLinks(status: MatchdayStatus) {
  return (
    status === MatchdayStatus.LINEUPS_LOCKED ||
    status === MatchdayStatus.VOTES_PENDING ||
    status === MatchdayStatus.VOTES_COMPLETED ||
    status === MatchdayStatus.SCORES_CALCULATED
  );
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

export default async function AdminMatchdayDetailPage({
  params,
  searchParams
}: AdminMatchdayDetailPageProps) {
  const { matchdayId } = await params;
  const { error, notice } = await searchParams;
  const matchday = await getAdminMatchdayDetailData(matchdayId);

  if (!matchday) {
    notFound();
  }

  const openAction = openLineupsAction.bind(null, matchday.id);
  const closeAction = lockLineupsAction.bind(null, matchday.id);
  const redirectPath = `/admin/matchdays/${matchday.id}`;
  const hasFixtures = matchday._count.fixtures > 0;
  const hasRequiredVotes = matchday._count.requiredVotes > 0;
  const canCalculateScores =
    matchday.status === MatchdayStatus.VOTES_COMPLETED;
  const canPublish = matchday.status === MatchdayStatus.SCORES_CALCULATED;
  const canGenerateFixtureResults =
    matchday.status === MatchdayStatus.SCORES_CALCULATED && hasFixtures;
  const publicMatchdayPath = `/leagues/${matchday.league.id}/matchdays/${matchday.id}`;

  return (
    <AdminShell
      title={`Giornata ${matchday.number}`}
      subtitle="Controlla lo stato della giornata e gestisci apertura o chiusura dell'inserimento formazioni."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">
              Lega: <strong>{matchday.league.name}</strong>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Numero giornata: <strong>{matchday.number}</strong> | Squadre lega:{" "}
              <strong>{matchday.league._count.fantasyTeams}</strong> | Formazioni
              inserite:{" "}
              <strong>
                {matchday.insertedLineupsCount}/{matchday.league._count.fantasyTeams}
              </strong>
              {matchday.missingLineupsCount > 0 ? (
                <>
                  {" "}
                  | Mancanti: <strong>{matchday.missingLineupsCount}</strong>
                </>
              ) : null}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Fixture generate: <strong>{matchday._count.fixtures}</strong> | Voti
              richiesti: <strong>{matchday._count.requiredVotes}</strong>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Voti completati: <strong>{matchday.completedVotesCount}</strong> |
              Mancanti: <strong>{matchday.missingVotesCount}</strong> | Team score
              calcolati: <strong>{matchday._count.teamScores}</strong>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Giocatori utili: <strong>{matchday._count.requiredVotes}</strong> | Voti
              salvati: <strong>{matchday._count.playerVotes}</strong> | Team score:{" "}
              <strong>{matchday._count.teamScores}</strong>
            </p>
          </div>

          <StatusBadge status={matchday.status} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Stato formazioni
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Per ogni squadra: se la formazione e stata inserita per questa
              giornata.
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Inserite: <strong>{matchday.insertedLineupsCount}</strong> | Recuperate:{" "}
            <strong>{matchday.autoCarriedLineupsCount}</strong> | Non inserite:{" "}
            <strong>{matchday.missingLineupsCount}</strong>
          </p>
        </div>

        {matchday.teamLineupStatuses.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Nessuna squadra in questa lega.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {matchday.teamLineupStatuses.map((team) => {
              const badgeClass =
                team.formationStatus === "INSERITA"
                  ? "bg-emerald-50 text-emerald-800"
                  : team.formationStatus === "RECUPERATA"
                    ? "bg-sky-50 text-sky-800"
                    : team.formationStatus === "ADMIN"
                      ? "bg-violet-50 text-violet-800"
                      : "bg-amber-50 text-amber-800";

              const badgeLabel =
                team.formationStatus === "INSERITA"
                  ? "INSERITA"
                  : team.formationStatus === "RECUPERATA"
                    ? "RECUPERATA"
                    : team.formationStatus === "ADMIN"
                      ? "ADMIN"
                      : "NON INSERITA";

              return (
                <li
                  key={team.fantasyTeamId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {team.fantasyTeamName}
                    </p>
                    <p className="text-sm text-slate-600">
                      {team.ownerDisplayName ?? team.ownerEmail}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
                  >
                    {badgeLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Azioni disponibili</h2>

        <div className="mt-5 flex flex-wrap gap-3">
          {matchday.status === MatchdayStatus.DRAFT ? (
            <form action={openAction}>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Apri inserimento formazioni
              </button>
            </form>
          ) : null}

          {matchday.status === MatchdayStatus.LINEUPS_OPEN ? (
            <form action={closeAction}>
              <button
                type="submit"
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
              >
                Chiudi formazioni
              </button>
            </form>
          ) : null}

          {matchday.status === MatchdayStatus.LINEUPS_LOCKED ? (
            <>
              {!hasFixtures ? (
                <ActionForm action={generateFantasyFixturesAction}>
                  <input type="hidden" name="leagueId" value={matchday.league.id} />
                  <input type="hidden" name="matchdayId" value={matchday.id} />
                  <input type="hidden" name="redirectPath" value={redirectPath} />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Genera scontri giornata
                  </button>
                </ActionForm>
              ) : null}

              <ActionForm action={generateRequiredVotePlayersAction}>
                <input type="hidden" name="leagueId" value={matchday.league.id} />
                <input type="hidden" name="matchdayId" value={matchday.id} />
                <input type="hidden" name="redirectPath" value={redirectPath} />
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Genera lista voti richiesti
                </button>
              </ActionForm>
            </>
          ) : null}

          {matchday.status === MatchdayStatus.VOTES_PENDING ? (
            <Link
              href={`/admin/matchdays/${matchday.id}/votes`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Inserisci voti
            </Link>
          ) : null}

          {matchday.status === MatchdayStatus.VOTES_COMPLETED ? (
            <ActionForm action={calculateMatchdayScoresAction}>
              <input type="hidden" name="leagueId" value={matchday.league.id} />
              <input type="hidden" name="matchdayId" value={matchday.id} />
              <input type="hidden" name="redirectPath" value={redirectPath} />
              <button
                type="submit"
                disabled={!canCalculateScores}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Calcola punteggi squadre
              </button>
            </ActionForm>
          ) : null}

          {matchday.status === MatchdayStatus.SCORES_CALCULATED ? (
            <>
              {hasFixtures ? (
                <ActionForm action={calculateFantasyFixtureResultsAction}>
                  <input type="hidden" name="leagueId" value={matchday.league.id} />
                  <input type="hidden" name="matchdayId" value={matchday.id} />
                  <input type="hidden" name="redirectPath" value={redirectPath} />
                  <button
                    type="submit"
                    disabled={!canGenerateFixtureResults}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-200"
                  >
                    Genera/aggiorna risultati scontri
                  </button>
                </ActionForm>
              ) : null}

              <Link
                href={`/admin/matchdays/${matchday.id}/scores`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Vedi punteggi
              </Link>

              <ActionForm action={publishMatchdayAction}>
                <input type="hidden" name="leagueId" value={matchday.league.id} />
                <input type="hidden" name="matchdayId" value={matchday.id} />
                <input type="hidden" name="redirectPath" value={redirectPath} />
                <button
                  type="submit"
                  disabled={!canPublish}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200"
                >
                  Pubblica giornata
                </button>
              </ActionForm>
            </>
          ) : null}

          {matchday.status === MatchdayStatus.PUBLISHED ? (
            <>
              <Link
                href={publicMatchdayPath}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Pagina pubblica giornata
              </Link>
              <Link
                href={`/admin/leagues/${matchday.league.id}/standings`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Classifica
              </Link>
              <Link
                href={`/admin/matchdays/${matchday.id}/scores`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Punteggi
              </Link>
            </>
          ) : null}

          {matchday.status === MatchdayStatus.LOCKED ? (
            <>
              <Link
                href={publicMatchdayPath}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Pagina pubblica giornata
              </Link>
              <Link
                href={`/admin/leagues/${matchday.league.id}/standings`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Classifica
              </Link>
              <Link
                href={`/admin/matchdays/${matchday.id}/scores`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Punteggi
              </Link>
            </>
          ) : null}

          {canShowPostLineupLinks(matchday.status) ? (
            <>
              {hasRequiredVotes ? (
                <Link
                  href={`/admin/matchdays/${matchday.id}/votes`}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Gestisci voti
                </Link>
              ) : null}
              {matchday._count.teamScores > 0 ? (
                <Link
                  href={`/admin/matchdays/${matchday.id}/scores`}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Vedi punteggi
                </Link>
              ) : null}
            </>
          ) : null}

          <Link
            href={`/admin/leagues/${matchday.league.id}/matchdays/new`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Crea un'altra giornata
          </Link>
        </div>

        {matchday.status === MatchdayStatus.LINEUPS_LOCKED && hasFixtures ? (
          <p className="mt-4 text-sm text-slate-600">
            Gli scontri della giornata sono gia presenti. Puoi rigenerare la lista dei
            voti richiesti e poi passare all&apos;inserimento voti.
          </p>
        ) : null}

        {matchday.status === MatchdayStatus.SCORES_CALCULATED && !hasFixtures ? (
          <p className="mt-4 text-sm text-amber-700">
            Genera prima gli scontri della giornata.
          </p>
        ) : null}

        {matchday.status === MatchdayStatus.VOTES_PENDING && !hasRequiredVotes ? (
          <p className="mt-4 text-sm text-amber-700">
            Genera prima la lista dei voti richiesti.
          </p>
        ) : null}

        {matchday.status === MatchdayStatus.LINEUPS_LOCKED ? (
          <p className="mt-4 text-sm text-slate-600">
            Le formazioni sono chiuse. Da qui puoi proseguire con voti e punteggi.
          </p>
        ) : null}

        {matchday.status === MatchdayStatus.LOCKED ? (
          <p className="mt-4 text-sm text-slate-600">
            Giornata bloccata: nessuna ulteriore operazione disponibile.
          </p>
        ) : null}
      </section>
    </AdminShell>
  );
}
