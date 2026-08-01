import { UserRole } from "@prisma/client";

import { setUserAppRoleAction } from "@/app/admin/actions";
import { appRoleLabel, ASSIGNABLE_APP_ROLES } from "@/lib/auth/app-roles.ts";

type PlatformUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  authUserId: string | null;
};

type PlatformRolesPanelProps = {
  users: PlatformUserRow[];
};

export function PlatformRolesPanel({ users }: PlatformRolesPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Ruoli piattaforma
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Assegna Admin (accesso completo) o Mister (pagelle XLS, calendario,
          giornate e punteggi). Solo gli Admin possono modificare i ruoli.
        </p>
      </div>

      {users.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">Nessun utente registrato.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 font-medium">Utente</th>
                <th className="px-2 py-2 font-medium">Ruolo attuale</th>
                <th className="px-2 py-2 font-medium">Assegna</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-2 py-3 align-top">
                    <div className="font-medium text-slate-900">
                      {user.displayName?.trim() || "Senza nome"}
                    </div>
                    <div className="text-slate-600">{user.email}</div>
                    {!user.authUserId ? (
                      <div className="mt-1 text-xs text-amber-700">
                        Non ancora collegato a Supabase Auth
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 align-top text-slate-700">
                    {appRoleLabel(user.role)}
                  </td>
                  <td className="px-2 py-3 align-top">
                    <form
                      action={setUserAppRoleAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="sr-only" htmlFor={`role-${user.id}`}>
                        Ruolo per {user.email}
                      </label>
                      <select
                        id={`role-${user.id}`}
                        name="role"
                        defaultValue={user.role}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                      >
                        {ASSIGNABLE_APP_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {appRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      >
                        Salva
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
