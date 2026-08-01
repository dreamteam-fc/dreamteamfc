import Link from "next/link";
import { notFound } from "next/navigation";

import { createFantasyTeamAction } from "@/app/me/actions";
import { BrandPanel } from "@/components/brand/brand-panel";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";
import { getLeagueJoinPageData } from "@/lib/server/me/read-user-data";

export const dynamic = "force-dynamic";

type JoinLeaguePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

function Feedback({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {error}
    </div>
  );
}

export default async function JoinLeaguePage({
  params,
  searchParams
}: JoinLeaguePageProps) {
  const { leagueId } = await params;
  const { error } = await searchParams;
  const authContext = await requireAuthenticatedAppUser(
    `/leagues/${leagueId}/join`
  );
  const data = await getLeagueJoinPageData(leagueId, authContext.appUser.id);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-brand-fog px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <BrandPanel
          title="Entra nella lega"
          description={`Lega ${data.league.name} | Membri ${data.league._count.members} | Squadre ${data.league._count.fantasyTeams}/${data.league.maxTeams}`}
        />

        <Feedback error={error} />

        {data.existingLeagueTeam ? (
          <section className="surface-card p-6">
            <h2 className="text-xl font-semibold text-brand-ink">
              Hai gia una squadra in questa lega: {data.existingLeagueTeam.name}
            </h2>
            {data.scheduleGenerated ? (
              <p className="mt-2 text-sm text-amber-700">
                Le iscrizioni sono chiuse perché il calendario è già stato generato.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/me/teams/${data.existingLeagueTeam.id}`}
                className="btn-brand"
              >
                Apri la mia squadra
              </Link>
              <Link
                href={`/leagues/${data.league.id}`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Torna alla lega
              </Link>
            </div>
          </section>
        ) : data.scheduleGenerated ? (
          <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Iscrizioni chiuse
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Le iscrizioni sono chiuse perché il calendario è già stato generato.
            </p>
            <div className="mt-4">
              <Link
                href={`/leagues/${data.league.id}`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Torna alla lega
              </Link>
            </div>
          </section>
        ) : data.isFull ? (
          <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Lega piena</h2>
            <p className="mt-2 text-sm text-slate-600">
              La lega ha raggiunto il numero massimo di squadre:{" "}
              <strong>{data.league.maxTeams}</strong>.
            </p>
            <div className="mt-4">
              <Link
                href={`/leagues/${data.league.id}`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Torna alla lega
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Crea la tua squadra fantasy
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Squadre iscritte: <strong>{data.league._count.fantasyTeams}</strong> /{" "}
              <strong>{data.league.maxTeams}</strong>. Puoi avere una squadra per
              ogni lega.
            </p>

            <form action={createFantasyTeamAction} className="mt-5 space-y-4">
              <input type="hidden" name="leagueId" value={data.league.id} />

              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Nome squadra</span>
                <input
                  type="text"
                  name="teamName"
                  maxLength={50}
                  disabled={!data.canJoin}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Inserisci il nome della tua squadra"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Password di lega</span>
                <input
                  type="password"
                  name="password"
                  required
                  disabled={!data.canJoin}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Password impostata dall'admin"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!data.canJoin}
                  className="btn-brand"
                >
                  Crea squadra
                </button>
                <Link
                  href={`/leagues/${data.league.id}`}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Annulla
                </Link>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
