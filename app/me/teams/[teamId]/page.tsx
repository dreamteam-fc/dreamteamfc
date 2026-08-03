import Link from "next/link";
import { notFound } from "next/navigation";

import {
  inviteTeamCoachAction,
  leaveLeagueAction,
  regenerateTeamCoachInviteAction,
  revokeTeamCoachAction,
  revokeTeamCoachInviteAction
} from "@/app/me/actions";
import { CopyableInviteLink } from "@/components/me/copyable-invite-link";
import { TeamLogoManager } from "@/components/me/team-logo-manager";
import { TeamLogo } from "@/components/teams/team-logo";
import { getPlayerRoleLabel } from "@/lib/players/player-role";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import { listTeamCoachManagement } from "@/lib/server/coaches/team-coach-invites";
import { buildTeamCoachInviteUrl } from "@/lib/server/http/app-origin";
import { getUserTeamPageData } from "@/lib/server/me/read-user-data";
import { validateRosterComposition } from "@/lib/server/rosters/validate-roster-composition";
import {
  canManageCoachInvites,
  canManageRoster,
  canManageTeamLogo,
  canViewTeamAsCoachOrOwner,
  resolveTeamAccessRole
} from "@/lib/server/teams/team-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TeamPageProps = {
  params: Promise<{
    teamId: string;
  }>;
  searchParams: Promise<{
    coachInviteToken?: string;
    error?: string;
    notice?: string;
  }>;
};

function Feedback({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) {
    return null;
  }

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

function getFixtureSummary(
  teamId: string,
  fixture:
    | {
        awayGoals: number | null;
        awayTeam: { id: string; name: string };
        homeGoals: number | null;
        homeTeam: { id: string; name: string };
      }
    | undefined
) {
  if (!fixture) {
    return {
      isBye: true as const
    };
  }

  const isHome = fixture.homeTeam.id === teamId;
  const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
  const hasResult =
    fixture.homeGoals !== null && fixture.awayGoals !== null;

  return {
    hasResult,
    isAway: !isHome,
    isBye: false as const,
    isHome,
    opponent,
    resultLabel: hasResult
      ? `${fixture.homeGoals} - ${fixture.awayGoals}`
      : null
  };
}

export default async function TeamPage({ params, searchParams }: TeamPageProps) {
  const { teamId } = await params;
  const { coachInviteToken, error, notice } = await searchParams;
  const authContext = await requireAuthenticatedAppUser(`/me/teams/${teamId}`);
  const team = await getUserTeamPageData(teamId);

  if (!team) {
    notFound();
  }

  const accessRole = await resolveTeamAccessRole({
    appUserId: authContext.appUser.id,
    appUserRole: authContext.appUser.role,
    teamId: team.id,
    teamOwnerId: team.userId
  });

  if (!canViewTeamAsCoachOrOwner(accessRole)) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
        Accesso non autorizzato.
      </section>
    );
  }

  const isOwner = accessRole === "owner";
  const isCoach = accessRole === "coach";
  const showRosterManage = canManageRoster(accessRole);
  const showLogoManage = canManageTeamLogo(accessRole);
  const showCoachManage = canManageCoachInvites(accessRole);
  const coachManagement = showCoachManage
    ? await listTeamCoachManagement(team.id)
    : null;

  const rosterValidation = validateRosterComposition(
    team.roster.map((entry) => ({
      isBlockedInLeague: entry.player.isBlockedInLeague,
      isGloballyInactive: !entry.player.isActive,
      role: entry.player.role
    }))
  );
  const rosterStatus = !rosterValidation.isComplete
    ? "Rosa incompleta"
    : rosterValidation.isValid
      ? "Rosa valida"
      : "Rosa completa ma non valida";
  const nextMatchdaySummary = team.nextMatchday
    ? getFixtureSummary(team.id, team.nextMatchday.fixtures[0])
    : null;
  const coachInviteUrl = coachInviteToken
    ? await buildTeamCoachInviteUrl(coachInviteToken)
    : null;

  return (
    <div className="space-y-6">
      <Feedback error={error} notice={notice} />

      {coachInviteUrl ? (
        <section className="rounded-2xl border border-brand-blue/30 bg-blue-50 p-5 text-sm text-slate-800">
          <p className="font-semibold text-brand-ink">Link invito allenatore</p>
          <p className="mt-2 text-slate-600">
            Copia e invia questo link all&apos;allenatore. Viene mostrato solo
            ora: se lo perdi, usa &quot;Nuovo link&quot; sull&apos;invito
            pendente.
          </p>
          <CopyableInviteLink url={coachInviteUrl} />
          <p className="mt-2 text-slate-600">
            Scade tra 14 giorni. Non viene inviata alcuna email automatica.
          </p>
        </section>
      ) : null}

      {isCoach ? (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          Accesso allenatore: puoi solo impostare le formazioni. Rosa e lega restano
          del proprietario.
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <TeamLogo
              alt={`Logo ${team.name}`}
              cacheBust={team.updatedAt}
              logoPath={team.logoPath}
              size="md"
            />
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {team.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Lega: <strong>{team.league.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {showRosterManage ? (
              <Link
                href={`/me/teams/${team.id}/roster`}
                className="btn-brand"
              >
                Gestisci rosa
              </Link>
            ) : null}
            <Link
              href={`/leagues/${team.league.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Apri lega
            </Link>
            <Link
              href={`/leagues/${team.league.id}/standings`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Classifica pubblica
            </Link>
          </div>
        </div>
      </section>

      <TeamLogoManager
        canManage={showLogoManage}
        logoPath={team.logoPath}
        teamId={team.id}
        teamName={team.name}
        updatedAt={team.updatedAt}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Stato rosa</h2>
        <p className="mt-2 text-sm text-slate-600">
          Stato: <strong>{rosterStatus}</strong> | Totale:{" "}
          <strong>{rosterValidation.total}</strong> | Portieri:{" "}
          <strong>{rosterValidation.goalkeeperCount}</strong> | Difensori:{" "}
          <strong>{rosterValidation.defenderCount}</strong> | Centrocampisti:{" "}
          <strong>{rosterValidation.midfielderCount}</strong> | Attaccanti:{" "}
          <strong>{rosterValidation.attackerCount}</strong>
        </p>

        {rosterValidation.errors.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-rose-700">
            {rosterValidation.errors.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Prossima giornata
        </h2>

        {!team.nextMatchday ? (
          <p className="mt-4 text-sm text-slate-600">
            Nessuna giornata futura disponibile al momento.
          </p>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Giornata #{team.nextMatchday.number}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Stato: <strong>{team.nextMatchday.status}</strong>
                  {team.nextMatchday.lineupDeadlineAt ? (
                    <>
                      {" "}
                      | Deadline:{" "}
                      <strong>
                        {new Intl.DateTimeFormat("it-IT", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        }).format(team.nextMatchday.lineupDeadlineAt)}
                      </strong>
                    </>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {nextMatchdaySummary?.isBye
                    ? "Turno di riposo"
                    : `${nextMatchdaySummary?.isHome ? "Casa" : "Trasferta"} vs ${nextMatchdaySummary?.opponent.name}`}
                </p>
              </div>

              {!nextMatchdaySummary?.isBye &&
              team.nextMatchday.status === "LINEUPS_OPEN" ? (
                <Link
                  href={`/me/teams/${team.id}/matchdays/${team.nextMatchday.id}/lineup`}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Schiera formazione
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Calendario</h2>

        {team.league.matchdays.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Nessuna giornata disponibile per questa lega.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {team.league.matchdays.map((matchday) => {
              const existingLineup = team.lineups.find(
                (lineup) => lineup.matchdayId === matchday.id
              );
              const fixtureSummary = getFixtureSummary(
                team.id,
                matchday.fixtures[0]
              );

              return (
                <article
                  key={matchday.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Giornata #{matchday.number}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Stato: <strong>{matchday.status}</strong>
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {fixtureSummary.isBye
                          ? "Turno di riposo"
                          : `${fixtureSummary.isHome ? "Casa" : "Trasferta"} vs ${fixtureSummary.opponent.name}`}
                      </p>
                      {!fixtureSummary.isBye && fixtureSummary.resultLabel ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Risultato: <strong>{fixtureSummary.resultLabel}</strong>
                        </p>
                      ) : null}
                      {existingLineup ? (
                        <p className="mt-2 text-sm text-emerald-700">
                          Formazione inserita
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {!fixtureSummary.isBye &&
                      matchday.status === "LINEUPS_OPEN" ? (
                        <Link
                          href={`/me/teams/${team.id}/matchdays/${matchday.id}/lineup`}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                        >
                          {existingLineup ? "Modifica formazione" : "Schiera formazione"}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {team.roster.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          La rosa non e ancora stata assegnata.
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Rosa</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Giocatore</th>
                  <th className="px-3 py-2 font-medium">Ruolo</th>
                  <th className="px-3 py-2 font-medium">Squadra reale</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.roster.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 text-slate-900">
                      {entry.player.name}
                      {entry.player.isBlockedInLeague || !entry.player.isActive ? (
                        <span className="ml-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                          Non disponibile
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {getPlayerRoleLabel(entry.player.role)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {entry.player.teamName ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {entry.player.source ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showCoachManage && coachManagement ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Allenatore</h2>
          <p className="mt-2 text-sm text-slate-600">
            Invita un account che potra solo schierare la formazione di questa
            squadra. Dopo &quot;Crea invito&quot; (o &quot;Nuovo link&quot;)
            compare il link assoluto da copiare e condividere manualmente: non
            viene inviata alcuna email.
          </p>

          {coachManagement.activeCoaches.length > 0 ? (
            <div className="mt-4 space-y-3">
              {coachManagement.activeCoaches.map((coach) => (
                <div
                  key={coach.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="text-sm text-slate-700">
                    <strong>{coach.user.displayName ?? coach.user.email}</strong>
                    <span className="text-slate-500"> — {coach.user.email}</span>
                  </div>
                  <form action={revokeTeamCoachAction}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      Rimuovi
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Nessun allenatore attivo.</p>
          )}

          {coachManagement.pendingInvites.length > 0 ? (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Inviti pendenti
              </h3>
              {coachManagement.pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
                >
                  <div>
                    <strong>{invite.inviteeEmail}</strong>
                    <span className="text-slate-600">
                      {" "}
                      — scade{" "}
                      {new Intl.DateTimeFormat("it-IT", {
                        dateStyle: "medium"
                      }).format(invite.expiresAt)}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      Il token non e recuperabile: usa &quot;Nuovo link&quot; per
                      generarne uno fresco da copiare.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={regenerateTeamCoachInviteAction}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-brand-blue/40 bg-white px-3 py-2 font-medium text-brand-ink transition hover:border-brand-blue"
                      >
                        Nuovo link
                      </button>
                    </form>
                    <form action={revokeTeamCoachInviteAction}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-amber-300 bg-white px-3 py-2 font-medium text-amber-800 transition hover:border-amber-400"
                      >
                        Annulla invito
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <form action={inviteTeamCoachAction} className="mt-5 space-y-3">
            <input type="hidden" name="teamId" value={team.id} />
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Email allenatore</span>
              <input
                type="email"
                name="inviteeEmail"
                required
                className="w-full max-w-md rounded-xl border border-slate-300 px-3 py-2"
                placeholder="allenatore@email.com"
              />
            </label>
            <button type="submit" className="btn-brand">
              Crea invito
            </button>
          </form>
        </section>
      ) : null}

      {isOwner ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Abbandona lega</h2>
          <p className="mt-2 text-sm text-slate-600">
            Puoi abbandonare questa lega solo se la squadra non ha ancora
            partecipato ad alcuna giornata.
          </p>

          {team.leagueScheduleGenerated ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Non puoi abbandonare questa lega perché il calendario è già stato
              generato.
            </div>
          ) : team.canLeaveLeague ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              L'operazione elimina la squadra e la rosa associata. Non verranno
              toccate altre leghe.
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Non puoi abbandonare questa lega perche la squadra ha gia
              partecipato a una giornata.
            </div>
          )}

          <form action={leaveLeagueAction.bind(null, team.id)} className="mt-5 space-y-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="confirmLeaveLeague"
                value="yes"
                disabled={!team.canLeaveLeague}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>Confermo di voler abbandonare questa lega</span>
            </label>

            <button
              type="submit"
              disabled={!team.canLeaveLeague}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-200"
            >
              Abbandona lega
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
