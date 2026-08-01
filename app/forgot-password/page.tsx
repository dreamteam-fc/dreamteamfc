import Link from "next/link";

import { forgotPasswordAction } from "@/app/auth/actions";
import { BrandPanel } from "@/components/brand/brand-panel";
import { getSafeNextPath } from "@/lib/auth/app-user";

export const dynamic = "force-dynamic";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
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

export default async function ForgotPasswordPage({
  searchParams
}: ForgotPasswordPageProps) {
  const { error, next, notice } = await searchParams;
  const nextPath = getSafeNextPath(next, "/me");

  return (
    <main className="min-h-screen bg-brand-fog px-6 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <BrandPanel
          title="Recupera password"
          description="Inserisci l'email. Se esiste, riceverai un link per impostare una nuova password."
        />

        <Feedback error={error} notice={notice} />

        <section className="surface-card p-6">
          <form action={forgotPasswordAction} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <button type="submit" className="btn-brand w-full">
              Invia istruzioni
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm text-slate-600">
            <p>
              Hai gia un account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="font-medium text-slate-900 underline"
              >
                Accedi
              </Link>
            </p>
            <p>
              Non hai un account?{" "}
              <Link
                href={`/signup?next=${encodeURIComponent(nextPath)}`}
                className="font-medium text-slate-900 underline"
              >
                Registrati
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
