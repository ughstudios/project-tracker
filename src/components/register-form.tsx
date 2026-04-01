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
      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
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
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("common.email")}</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
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
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          placeholder={t("register.passwordHint")}
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
      >
        {pending ? t("register.submitting") : t("register.requestAccess")}
      </button>
      <p className="text-center text-sm text-zinc-600">
        {t("register.alreadyApproved")}{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          {t("register.goLogin")}
        </Link>
      </p>
    </form>
  );
}
