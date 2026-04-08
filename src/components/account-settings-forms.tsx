"use client";

import {
  updateEmailAction,
  updateNameAction,
  updatePasswordAction,
} from "@/app/(app)/account/actions";
import { logoutAction } from "@/app/actions";
import { useI18n } from "@/i18n/context";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

type PasswordState = { error?: string; ok?: boolean };
type EmailState = { error?: string; ok?: boolean };
type NameState = { error?: string; ok?: boolean };

const passwordInitial: PasswordState = {};
const emailInitial: EmailState = {};
const nameInitial: NameState = {};

export function AccountSettingsForms({
  currentName,
  currentEmail,
}: {
  currentName: string;
  currentEmail: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    updatePasswordAction,
    passwordInitial,
  );
  const [emailState, emailFormAction, emailPending] = useActionState(updateEmailAction, emailInitial);
  const [nameState, nameFormAction, namePending] = useActionState(updateNameAction, nameInitial);

  useEffect(() => {
    if (!nameState?.ok) return;
    router.refresh();
  }, [nameState?.ok, router]);

  useEffect(() => {
    if (!emailState?.ok) return;
    (async () => {
      await logoutAction();
      router.replace("/login?message=email-changed");
      router.refresh();
    })();
  }, [emailState?.ok, router]);

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("account.changeName")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("account.nameHelp")}</p>
        <form action={nameFormAction} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("account.displayName")}</label>
            <input
              key={currentName}
              name="name"
              type="text"
              required
              maxLength={200}
              autoComplete="name"
              defaultValue={currentName}
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          {nameState?.error ? <p className="text-sm text-red-600">{nameState.error}</p> : null}
          {nameState?.ok ? <p className="text-sm text-emerald-700">{t("account.nameOk")}</p> : null}
          <button
            type="submit"
            disabled={namePending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {namePending ? t("common.saving") : t("account.updateName")}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("account.changePassword")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("account.passwordHelp")}</p>
        <form action={passwordFormAction} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("account.currentPassword")}</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("account.newPassword")}</label>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("account.confirmPassword")}</label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          {passwordState?.error ? <p className="text-sm text-red-600">{passwordState.error}</p> : null}
          {passwordState?.ok ? (
            <p className="text-sm text-emerald-700">{t("account.passwordOk")}</p>
          ) : null}
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {passwordPending ? t("common.saving") : t("account.updatePassword")}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("account.changeEmail")}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {t("account.emailHelp", { email: currentEmail })}
        </p>
        <form action={emailFormAction} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("account.currentPassword")}</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("account.newEmail")}</label>
            <input
              name="newEmail"
              type="email"
              required
              autoComplete="email"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          {emailState?.error ? <p className="text-sm text-red-600">{emailState.error}</p> : null}
          {emailPending ? (
            <p className="text-sm text-zinc-600">{t("account.emailUpdating")}</p>
          ) : null}
          <button
            type="submit"
            disabled={emailPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {emailPending ? t("common.saving") : t("account.updateEmail")}
          </button>
        </form>
      </section>
    </div>
  );
}
