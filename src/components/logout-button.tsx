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
      className="btn-secondary w-full rounded-lg px-3 py-2 text-sm font-medium"
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
