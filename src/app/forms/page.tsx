import { GuestLanguageBar } from "@/components/guest-chrome";
import { PublicAccessTabs } from "@/components/public-access-tabs";
import { PublicCalibrationRequestForm } from "@/components/public-calibration-request-form";

export default function FormsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-4">
      <GuestLanguageBar />
      <PublicAccessTabs />
      <div className="panel-surface rounded-xl p-6">
        <h1 className="text-2xl font-semibold">Calibration Request Form</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fill out this form so our team can prepare and schedule your calibration work.
        </p>
        <div className="mt-6">
          <PublicCalibrationRequestForm />
        </div>
      </div>
    </main>
  );
}
