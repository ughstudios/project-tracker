"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions";
import { useI18n } from "@/i18n/context";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
          router.replace("/login");
          router.refresh();
        });
      }}
    >
      {pending ? t("logout.loggingOut") : t("logout.logout")}
    </button>
  );
}
