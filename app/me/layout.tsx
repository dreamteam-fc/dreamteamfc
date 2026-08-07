import type { ReactNode } from "react";

import { UserShell } from "@/components/me/user-shell";
import { canAccessAdminArea } from "@/lib/auth/app-roles";
import { requireAuthenticatedAppUser } from "@/lib/auth/app-user";

export const dynamic = "force-dynamic";

type MeLayoutProps = {
  children: ReactNode;
};

export default async function MeLayout({ children }: MeLayoutProps) {
  const authContext = await requireAuthenticatedAppUser("/me");

  return (
    <UserShell
      title="La mia area"
      subtitle={`${authContext.appUser.displayName ?? authContext.appUser.email} | ${authContext.appUser.email}`}
      showAdminLink={canAccessAdminArea(authContext.appUser.role)}
    >
      {children}
    </UserShell>
  );
}
