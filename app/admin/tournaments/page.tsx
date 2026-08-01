import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { listTournamentsForAdmin } from "@/lib/server/tournaments/tournament-entries";

export const dynamic = "force-dynamic";

type TournamentsPageProps = {
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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bozza",
  ENTRIES_SET: "Squadre selezionate",
  BRACKET_GENERATED: "Tabellone pronto",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato"
};

export default async function TournamentsPage({
  searchParams
}: TournamentsPageProps) {
  const { error, notice } = await searchParams;
  const tournaments = await listTournamentsForAdmin();

  return (
    <AdminShell
      title="Tornei"
      subtitle="Tornei cross-lega post-campionato. Selezione squadre a mano dall'admin."
    >
      <Feedback error={error} notice={notice} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Elenco</h2>
            <p className="mt-2 text-sm text-slate-600">
              Crea un torneo, seleziona 4/8/16 squadre, poi genera il tabellone.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/tournaments"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Vista pubblica
            </Link>
            <Link
              href="/admin/tournaments/new"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Nuovo torneo
            </Link>
          </div>
        </div>

        {tournaments.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">Nessun torneo ancora.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {tournaments.map((tournament) => (
              <article
                key={tournament.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {tournament.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Stato:{" "}
                    <strong>
                      {STATUS_LABEL[tournament.status] ?? tournament.status}
                    </strong>{" "}
                    | Squadre: <strong>{tournament._count.entries}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/tournaments/${tournament.id}/entries`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Gestisci squadre
                  </Link>
                  {tournament.status === "ENTRIES_SET" ||
                  tournament.status === "BRACKET_GENERATED" ||
                  tournament.status === "IN_PROGRESS" ||
                  tournament.status === "COMPLETED" ? (
                    <Link
                      href={`/admin/tournaments/${tournament.id}/bracket`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Tabellone
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
