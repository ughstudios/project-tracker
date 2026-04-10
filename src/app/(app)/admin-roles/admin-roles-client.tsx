"use client";

import { useI18n } from "@/i18n/context";
import { ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_SUPER_ADMIN } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type RowUser = { id: string; name: string; email: string; role: string };

export function AdminRolesClient() {
  const { t } = useI18n();
  const router = useRouter();
  const passwordDialogRef = useRef<HTMLDialogElement>(null);
  const [users, setUsers] = useState<RowUser[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<RowUser | null>(null);
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

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

  const openPasswordDialog = (u: RowUser) => {
    setPasswordUser(u);
    setPwdNew("");
    setPwdConfirm("");
    passwordDialogRef.current?.showModal();
  };

  const closePasswordDialog = () => {
    passwordDialogRef.current?.close();
  };

  const submitPasswordReset = async () => {
    if (!passwordUser) return;
    if (pwdNew.length < 8) {
      alert(t("errors.account.newPasswordShort"));
      return;
    }
    if (pwdNew !== pwdConfirm) {
      alert(t("errors.account.passwordsMismatch"));
      return;
    }
    setPasswordSaving(true);
    const res = await fetch(`/api/users/${passwordUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: pwdNew,
        confirmPassword: pwdConfirm,
      }),
    });
    setPasswordSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("adminRoles.couldNotUpdatePassword"));
      return;
    }
    closePasswordDialog();
    router.refresh();
  };

  const peerSuperLocked = (u: RowUser) =>
    u.role === ROLE_SUPER_ADMIN && u.id !== meId;

  return (
    <div className="space-y-4">
      <dialog
        ref={passwordDialogRef}
        className="fixed left-1/2 top-1/2 z-[200] max-h-[90dvh] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl backdrop:bg-zinc-950/40"
        onClose={() => {
          setPasswordUser(null);
          setPwdNew("");
          setPwdConfirm("");
        }}
      >
        {passwordUser ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              {t("adminRoles.passwordDialogTitle", { name: passwordUser.name })}
            </h2>
            <p className="text-sm text-zinc-600">{t("adminRoles.passwordDialogHelp")}</p>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-800">
                {t("adminRoles.newPassword")}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input mt-1 w-full"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  disabled={passwordSaving}
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800">
                {t("adminRoles.confirmPassword")}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input mt-1 w-full"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  disabled={passwordSaving}
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                disabled={passwordSaving}
                onClick={() => closePasswordDialog()}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                disabled={passwordSaving}
                onClick={() => void submitPasswordReset()}
              >
                {passwordSaving ? t("common.saving") : t("adminRoles.updatePassword")}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>

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
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <th className="border border-zinc-200 px-2 py-2">{t("common.name")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("common.email")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("adminRoles.roleColumn")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("adminRoles.passwordColumn")}</th>
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
                    <td className="border border-zinc-200 px-2 py-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-700 disabled:opacity-50"
                        disabled={passwordSaving}
                        onClick={() => openPasswordDialog(u)}
                      >
                        {t("adminRoles.setPassword")}
                      </button>
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
