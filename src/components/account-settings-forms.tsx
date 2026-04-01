"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateEmailAction, updatePasswordAction } from "@/app/(app)/account/actions";
import { logoutAction } from "@/app/actions";

type PasswordState = { error?: string; ok?: boolean };
type EmailState = { error?: string; ok?: boolean };

const passwordInitial: PasswordState = {};
const emailInitial: EmailState = {};

export function AccountSettingsForms({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    updatePasswordAction,
    passwordInitial,
  );
  const [emailState, emailFormAction, emailPending] = useActionState(updateEmailAction, emailInitial);

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
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Use a strong password you do not use elsewhere.
        </p>
        <form action={passwordFormAction} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Current password</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New password</label>
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
            <label className="mb-1 block text-sm font-medium">Confirm new password</label>
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
            <p className="text-sm text-emerald-700">Password updated successfully.</p>
          ) : null}
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {passwordPending ? "Saving..." : "Update password"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Change email</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Current email: <span className="font-medium text-zinc-800">{currentEmail}</span>. You will be
          signed out and need to sign in with the new address.
        </p>
        <form action={emailFormAction} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Current password</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New email</label>
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
            <p className="text-sm text-zinc-600">Updating email and signing you out…</p>
          ) : null}
          <button
            type="submit"
            disabled={emailPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {emailPending ? "Saving..." : "Update email"}
          </button>
        </form>
      </section>
    </div>
  );
}
