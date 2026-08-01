import Link from "next/link";

import { createTournamentAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

type NewTournamentPageProps = {
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

export default async function NewTournamentPage({
  searchParams
}: NewTournamentPageProps) {
  const { error } = await searchParams;

  return (
    <AdminShell
      title="Nuovo torneo"
      subtitle="Crea un torneo cross-lega con password. Poi scegli a mano le squadre."
    >
      <Feedback error={error} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createTournamentAction} className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-700">
            <span className="font-medium">Nome torneo</span>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Es. Finali Dream Team FC"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-700">
            <span className="font-medium">Password di iscrizione</span>
            <input
              type="password"
              name="password"
              required
              minLength={4}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Password per i partecipanti"
            />
          </label>

          <p className="text-sm text-slate-600">
            Dopo la creazione selezionerai le squadre (4, 8 o 16) dalle leghe,
            con punti classifica per il seeding. Il tabellone arriva nello step
            successivo.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Crea torneo
            </button>
            <Link
              href="/admin/tournaments"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Annulla
            </Link>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
