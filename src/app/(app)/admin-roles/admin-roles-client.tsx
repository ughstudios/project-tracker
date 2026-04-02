"use client";

import { useI18n } from "@/i18n/context";
import { ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_SUPER_ADMIN } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RowUser = { id: string; name: string; email: string; role: string };

export function AdminRolesClient() {
  const { t } = useI18n();
  const router = useRouter();
  const [users, setUsers] = useState<RowUser[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [meRes, usersRes] = await Promise.all([fetch("/api/me"), fetch("/api/users")]);
    if (meRes.ok) {
      const me = (await meRes.json()) as { id?: string };
      setMeId(me.id ?? null);
    }
    if (usersRes.ok) setUsers((await usersRes.json()) as RowUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (userId: string, role: string) => {
    setSavingId(userId);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSavingId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("adminRoles.couldNotUpdate"));
      return;
    }
    await res.json();
    await load();
    router.refresh();
  };

  const peerSuperLocked = (u: RowUser) =>
    u.role === ROLE_SUPER_ADMIN && u.id !== meId;

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("adminRoles.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("adminRoles.subtitle")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-zinc-600">{t("adminRoles.loading")}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("adminRoles.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <th className="border border-zinc-200 px-2 py-2">{t("common.name")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("common.email")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("adminRoles.roleColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="odd:bg-white even:bg-zinc-50/50">
                    <td className="border border-zinc-200 px-2 py-2 font-medium text-zinc-900">
                      {u.name}
                      {u.id === meId ? (
                        <span className="ml-1 text-xs font-normal text-zinc-500">
                          ({t("adminRoles.you")})
                        </span>
                      ) : null}
                    </td>
                    <td className="border border-zinc-200 px-2 py-2 text-zinc-700">{u.email}</td>
                    <td className="border border-zinc-200 px-2 py-2">
                      {peerSuperLocked(u) ? (
                        <span className="text-zinc-600">{t("adminRoles.peerSuperLocked")}</span>
                      ) : (
                        <select
                          className="input max-w-[220px] text-sm"
                          disabled={savingId === u.id}
                          value={u.role}
                          onChange={(e) => void changeRole(u.id, e.target.value)}
                        >
                          <option value={ROLE_EMPLOYEE}>{t("adminRoles.roleEmployee")}</option>
                          <option value={ROLE_ADMIN}>{t("adminRoles.roleAdmin")}</option>
                          <option value={ROLE_SUPER_ADMIN}>{t("adminRoles.roleSuperAdmin")}</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
