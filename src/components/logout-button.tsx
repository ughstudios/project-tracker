"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
          router.replace("/login");
          router.refresh();
        });
      }}
    >
      {pending ? "Logging out..." : "Logout"}
    </button>
  );
}
