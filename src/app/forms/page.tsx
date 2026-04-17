import Link from "next/link";
import { GuestLanguageBar } from "@/components/guest-chrome";
import { PublicAccessTabs } from "@/components/public-access-tabs";
import { PUBLIC_FORMS } from "@/lib/public-forms";

export default function FormsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-4">
      <GuestLanguageBar />
      <PublicAccessTabs />
      <div className="panel-surface rounded-xl p-6">
        <h1 className="text-2xl font-semibold">Forms</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose the form you want to submit.
        </p>
        <div className="mt-6 grid gap-3">
          {PUBLIC_FORMS.map((form) => (
            <div
              key={form.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{form.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{form.description}</p>
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    form.status === "live"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                  ].join(" ")}
                >
                  {form.status === "live" ? "Live" : "Coming soon"}
                </span>
              </div>
              <div className="mt-3">
                {form.status === "live" ? (
                  <Link
                    href={form.href}
                    className="inline-flex rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Open form
                  </Link>
                ) : (
                  <Link
                    href={form.href}
                    className="inline-flex rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Preview
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
