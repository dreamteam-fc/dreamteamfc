import Link from "next/link";
import { notFound } from "next/navigation";

import { activateTournamentEntryAction } from "@/app/me/actions";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import { getUserTournamentActivationData } from "@/lib/server/tournaments/read-user-tournament-data";

export const dynamic = "force-dynamic";

type ActivatePageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ActivateTournamentPage({
  params,
  searchParams
}: ActivatePageProps) {
  const { tournamentId } = await params;
  const { error } = await searchParams;
  const authContext = await requireAuthenticatedAppUser(
    `/tournaments/${tournamentId}/activate`
  );
  const tournament = await getUserTournamentActivationData(
    tournamentId,
    authContext.appUser.id
  );

  if (!tournament) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-brand-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-brand-void text-white shadow-brand">
          <div className="brand-spectrum-bar" />
          <div className="bg-brand-aurora px-6 py-8">
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
              Sblocca accesso
            </h1>
            <p className="mt-3 text-sm text-brand-mute">
              Torneo <strong className="text-white">{tournament.name}</strong>.
              Solo le squadre selezionate dall&apos;admin possono entrare, con
              la password del torneo.
            </p>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {tournament.entries.length === 0 ? (
          <section className="surface-card p-6 text-sm text-slate-600">
            Nessuna tua squadra risulta selezionata per questo torneo.
            <div className="mt-4">
              <Link
                href={`/tournaments/${tournament.id}`}
                className="font-semibold text-brand-blue"
              >
                Vedi tabellone
              </Link>
            </div>
          </section>
        ) : (
          <section className="surface-card space-y-5 p-6">
            {tournament.entries.map((entry) => (
              <div
                key={entry.fantasyTeamId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <h2 className="text-lg font-semibold text-brand-ink">
                  {entry.fantasyTeam.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Lega: {entry.sourceLeague.name}
                  {entry.seedRank != null ? ` · Seed #${entry.seedRank}` : ""}
                </p>
                {entry.activatedAt ? (
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    Accesso gia attivo.
                  </p>
                ) : (
                  <form
                    action={activateTournamentEntryAction}
                    className="mt-4 space-y-3"
                  >
                    <input
                      type="hidden"
                      name="tournamentId"
                      value={tournament.id}
                    />
                    <input
                      type="hidden"
                      name="fantasyTeamId"
                      value={entry.fantasyTeamId}
                    />
                    <label className="block space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Password torneo</span>
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={4}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </label>
                    <button type="submit" className="btn-brand">
                      Sblocca
                    </button>
                  </form>
                )}
              </div>
            ))}
          </section>
        )}

        <Link
          href={`/tournaments/${tournament.id}`}
          className="text-sm font-semibold text-brand-blue"
        >
          ← Torna al torneo
        </Link>
      </div>
    </main>
  );
}
