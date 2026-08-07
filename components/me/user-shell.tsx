import Link from "next/link";

import { logoutAction } from "@/app/auth/actions";
import { BrandMark } from "@/components/brand/brand-mark";

type UserShellProps = {
  children: React.ReactNode;
  /** Staff (ADMIN | MISTER) — link to /admin. Same gate as requireStaffAccess. */
  showAdminLink?: boolean;
  subtitle?: string;
  title: string;
};

export function UserShell({
  children,
  showAdminLink = false,
  subtitle,
  title
}: UserShellProps) {
  return (
    <main className="min-h-screen bg-brand-fog px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl bg-brand-void text-white shadow-brand">
          <div className="brand-spectrum-bar" />
          <div className="relative flex flex-wrap items-center justify-between gap-4 bg-brand-aurora px-5 py-5 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <BrandMark size="sm" href="/" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-mute">
                  Area utente
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-2 max-w-3xl text-sm text-brand-mute">{subtitle}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/me"
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Dashboard
              </Link>
              <Link
                href="/tournaments"
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Tornei
              </Link>
              {showAdminLink ? (
                <Link
                  href="/admin"
                  className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Admin
                </Link>
              ) : null}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-xl border border-rose-300/50 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/25"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
