import Link from "next/link";
import { requireAdminAccess } from "@/lib/auth/admin.ts";

import { createLeagueAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

type NewLeaguePageProps = {
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

export default async function NewLeaguePage({
  searchParams
}: NewLeaguePageProps) {
  await requireAdminAccess();
  const { error } = await searchParams;

  return (
    <AdminShell
      title="Nuova lega"
      subtitle="Crea una lega da 10 squadre con password obbligatoria (andata/ritorno = 18 giornate)."
    >
      <Feedback error={error} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createLeagueAction} className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-700">
            <span className="font-medium">Nome lega</span>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Inserisci il nome della lega"
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
              placeholder="Password che gli utenti useranno per entrare"
            />
          </label>

          <p className="text-sm text-slate-600">
            Ogni lega ha esattamente <strong>10</strong> posti. Il calendario e
            solo andata e ritorno (18 giornate). La password non viene salvata in
            chiaro.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Crea lega
            </button>
            <Link
              href="/admin"
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
