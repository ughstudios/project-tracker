"use client";

import { loginAction } from "@/app/login/actions";
import { useI18n } from "@/i18n/context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

type LoginState = { error?: string; ok?: boolean };

const initialState: LoginState = {};

export function LoginForm({ bannerMessage }: { bannerMessage?: string } = {}) {
  const router = useRouter();
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (!state?.ok) return;
    router.replace("/");
    router.refresh();
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {bannerMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {bannerMessage}
        </p>
      ) : null}
      <div>
        <label className="mb-1 block text-sm font-medium">{t("common.email")}</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("common.password")}</label>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          placeholder="********"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
      >
        {pending ? t("login.signingIn") : t("login.signIn")}
      </button>
      <p className="text-center text-sm text-zinc-600">
        {t("login.needAccount")}{" "}
        <Link href="/register" className="font-medium text-zinc-900 underline">
          {t("login.register")}
        </Link>
      </p>
    </form>
  );
}
