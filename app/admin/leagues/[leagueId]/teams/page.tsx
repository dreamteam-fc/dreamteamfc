import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminLeagueTeamsData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type LeagueTeamsPageProps = {
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

export default async function AdminLeagueTeamsPage({
  params,
  searchParams
}: LeagueTeamsPageProps) {
  await requireAdminAccess();
  const { leagueId } = await params;
  const { error, notice } = await searchParams;
  const data = await getAdminLeagueTeamsData(leagueId);

  if (!data) {
    notFound();
  }

  return (
    <AdminShell
      title={`Squadre | ${data.league.name}`}
      subtitle="Gestisci le rose delle squadre utente (add / remove / replace)."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Squadre: <strong>{data.league.fantasyTeams.length}</strong> /{" "}
            <strong>{data.league.maxTeams}</strong>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/leagues/${leagueId}/schedule`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Calendario
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      {data.league.fantasyTeams.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Nessuna squadra nella lega.
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Squadra</th>
                <th className="px-4 py-3 font-medium">Utente</th>
                <th className="px-4 py-3 font-medium">Rosa</th>
                <th className="px-4 py-3 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.league.fantasyTeams.map((team) => (
                <tr key={team.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {team.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {team.user.displayName ?? team.user.email}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {team._count.roster}/25
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/teams/${team.id}/roster`}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Gestisci rosa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </AdminShell>
  );
}
