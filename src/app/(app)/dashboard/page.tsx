import { IssueDashboard } from "@/components/issue-dashboard";
import { getServerTranslator } from "@/i18n/server";

export default async function DashboardPage() {
  const t = await getServerTranslator();
  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("dashboard.subtitle")}</p>
      </header>
      <IssueDashboard />
    </div>
  );
}
