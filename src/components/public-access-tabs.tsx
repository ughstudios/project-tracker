"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/login", label: "Login" },
  { href: "/forms", label: "Forms" },
] as const;

export function PublicAccessTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Public pages"
      className="mb-4 grid w-full grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/forms"
            ? pathname === "/forms" || pathname.startsWith("/forms/")
            : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "rounded-md px-3 py-2 text-center text-sm font-medium transition-colors",
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
