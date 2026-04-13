"use client";

import { registerAction } from "@/app/register/actions";
import { useI18n } from "@/i18n/context";
import Link from "next/link";
import { useActionState } from "react";

type RegisterState = { error?: string; ok?: boolean };

const initialState: RegisterState = {};

export function RegisterForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  if (state?.ok) {
    return (
      <div className="mt-6 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-800 dark:text-emerald-200">
        {t("register.submitted")}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">{t("register.name")}</label>
        <input
          name="name"
          type="text"
          required
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("common.email")}</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          placeholder="jane@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("common.password")}</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          placeholder={t("register.passwordHint")}
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-50 dark:bg-zinc-9500"
      >
        {pending ? t("register.submitting") : t("register.requestAccess")}
      </button>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {t("register.alreadyApproved")}{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100 underline">
          {t("register.goLogin")}
        </Link>
      </p>
    </form>
  );
}
