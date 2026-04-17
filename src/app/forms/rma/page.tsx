import Link from "next/link";
import { GuestLanguageBar } from "@/components/guest-chrome";
import { PublicAccessTabs } from "@/components/public-access-tabs";

export default function RmaFormPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-4">
      <GuestLanguageBar />
      <PublicAccessTabs />
      <div className="panel-surface rounded-xl p-6">
        <h1 className="text-2xl font-semibold">RMA Request Form</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          This form is coming soon. We are setting up the required fields for returns and replacements.
        </p>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Planned fields include contact details, product serial numbers, failure description, and shipping information.
        </div>
        <Link
          href="/forms"
          className="mt-4 inline-flex rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
        >
          Back to Forms
        </Link>
      </div>
    </main>
  );
}
