import { requireStaffAccess } from "@/lib/auth/admin.ts";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Admin | Mister — page/actions enforce finer capabilities.
  await requireStaffAccess();

  return children;
}
