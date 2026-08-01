import Link from "next/link";

import { acceptTeamCoachInviteAction } from "@/app/me/actions";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import { getTeamCoachInviteByToken } from "@/lib/server/coaches/team-coach-invites";

export const dynamic = "force-dynamic";

type CoachInvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function CoachInvitePage({
  params,
  searchParams
}: CoachInvitePageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const authContext = await requireAuthenticatedAppUser(
    `/me/coach-invites/${token}`
  );
  const invite = await getTeamCoachInviteByToken(token);

  if (!invite) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        Invito non valido o non trovato.
      </section>
    );
  }

  const expired = invite.expiresAt.getTime() < Date.now();
  const canAccept = invite.status === "PENDING" && !expired;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="surface-card p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">
          Invito allenatore
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide text-brand-ink">
          {invite.fantasyTeam.name}
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Lega: <strong>{invite.fantasyTeam.league.name}</strong>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Invitato da:{" "}
          <strong>
            {invite.invitedBy.displayName ?? invite.invitedBy.email}
          </strong>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Email invito: <strong>{invite.inviteeEmail}</strong>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Sei connesso come: <strong>{authContext.appUser.email}</strong>
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Accettando potrai solo impostare le formazioni di questa squadra. Non
          potrai gestire rosa, abbandonare la lega o invitari altri.
        </p>

        {!canAccept ? (
          <p className="mt-5 text-sm font-medium text-amber-800">
            Questo invito non e piu accettabile (stato: {invite.status}
            {expired ? ", scaduto" : ""}).
          </p>
        ) : (
          <form action={acceptTeamCoachInviteAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn-brand">
              Accetta invito allenatore
            </button>
          </form>
        )}

        <div className="mt-6">
          <Link
            href="/me"
            className="text-sm font-semibold text-brand-blue hover:underline"
          >
            Torna alla dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
