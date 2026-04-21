import Link from "next/link";
import { GuestLanguageBar } from "@/components/guest-chrome";
import { PublicAccessTabs } from "@/components/public-access-tabs";
import { PublicProcessorRmaForm } from "@/components/public-processor-rma-form";
import { getServerTranslator } from "@/i18n/server";

export default async function RmaFormPage() {
  const t = await getServerTranslator();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-4">
      <GuestLanguageBar />
      <PublicAccessTabs />
      <div className="panel-surface rounded-xl p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t("publicForms.pages.rma.title")}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("publicForms.pages.rma.subtitle")}</p>
          </div>
          <Link
            href="/forms"
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            {t("publicForms.pages.rma.back")}
          </Link>
        </div>
        <PublicProcessorRmaForm />
      </div>
    </main>
  );
}
