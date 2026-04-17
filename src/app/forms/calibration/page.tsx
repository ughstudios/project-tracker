import Link from "next/link";
import { GuestLanguageBar } from "@/components/guest-chrome";
import { PublicAccessTabs } from "@/components/public-access-tabs";
import { PublicCalibrationRequestForm } from "@/components/public-calibration-request-form";

export default function CalibrationFormPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-4">
      <GuestLanguageBar />
      <PublicAccessTabs />
      <div className="panel-surface rounded-xl p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Calibration Request Form</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Fill out this form so our team can prepare and schedule your calibration work.
            </p>
          </div>
          <Link
            href="/forms"
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Back to Forms
          </Link>
        </div>
        <PublicCalibrationRequestForm />
      </div>
    </main>
  );
}
