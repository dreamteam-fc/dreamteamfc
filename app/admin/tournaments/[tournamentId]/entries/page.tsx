import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import {
  generateTournamentBracketAction,
  saveTournamentEntriesAction
} from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { TournamentEntriesForm } from "@/components/admin/tournament-entries-form";
import { getTournamentEntriesPageData } from "@/lib/server/tournaments/tournament-entries";

export const dynamic = "force-dynamic";

type TournamentEntriesPageProps = {
  params: Promise<{
    tournamentId: string;
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

export default async function TournamentEntriesPage({
  params,
  searchParams
}: TournamentEntriesPageProps) {
  await requireAdminAccess();
  const { tournamentId } = await params;
  const { error, notice } = await searchParams;
  const data = await getTournamentEntriesPageData(tournamentId);

  if (!data) {
    notFound();
  }

  const readOnly =
    data.tournament.status !== "DRAFT" &&
    data.tournament.status !== "ENTRIES_SET";
  const canGenerateBracket = data.tournament.status === "ENTRIES_SET";
  const hasBracket =
    data.tournament.status === "BRACKET_GENERATED" ||
    data.tournament.status === "IN_PROGRESS" ||
    data.tournament.status === "COMPLETED";

  return (
    <AdminShell
      title={`Squadre — ${data.tournament.name}`}
      subtitle="Seleziona a mano le squadre (4, 8, 16, 32 o 64). I punti classifica vengono salvati come snapshot per il seeding."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/admin/tournaments"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Torna ai tornei
          </Link>
          {hasBracket ? (
            <Link
              href={`/admin/tournaments/${data.tournament.id}/bracket`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Vedi tabellone
            </Link>
          ) : null}
          {canGenerateBracket ? (
            <form action={generateTournamentBracketAction}>
              <input
                type="hidden"
                name="tournamentId"
                value={data.tournament.id}
              />
              <button
                type="submit"
                className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0f4de0]"
              >
                Genera tabellone
              </button>
            </form>
          ) : null}
        </div>

        {data.tournament.entries.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Roster attuale</p>
            <ul className="mt-2 space-y-1">
              {data.tournament.entries.map((entry) => (
                <li key={entry.fantasyTeamId}>
                  {entry.fantasyTeam.name} ({entry.sourceLeague.name}) —{" "}
                  {entry.seedPoints} pt
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <TournamentEntriesForm
          action={saveTournamentEntriesAction}
          groups={data.eligible.groups}
          initialSelectedIds={Array.from(data.selectedIds)}
          readOnly={readOnly}
          tournamentId={data.tournament.id}
        />
      </section>
    </AdminShell>
  );
}
