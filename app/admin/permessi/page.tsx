import { AdminShell } from "@/components/admin/admin-shell";
import { PlatformRolesPanel } from "@/components/admin/platform-roles-panel";
import { requireAdminAccess } from "@/lib/auth/admin.ts";
import { getAdminPlatformUsersData } from "@/lib/server/admin/read-admin-data";

export const dynamic = "force-dynamic";

type AdminPermessiPageProps = {
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

export default async function AdminPermessiPage({
  searchParams
}: AdminPermessiPageProps) {
  const { error, notice } = await searchParams;
  await requireAdminAccess();
  const { users } = await getAdminPlatformUsersData();

  return (
    <AdminShell
      eyebrow="Admin"
      title="Permessi"
      subtitle="Gestisci i ruoli piattaforma degli utenti registrati (Utente, Mister, Admin)."
    >
      <Feedback error={error} notice={notice} />
      <PlatformRolesPanel users={users} />
    </AdminShell>
  );
}
