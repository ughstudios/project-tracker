"use client";

import { DashboardCharts } from "@/components/dashboard-charts";
import { useIssueBoardData } from "@/hooks/use-issue-board-data";
import { useI18n } from "@/i18n/context";

export function IssueDashboard() {
  const { t } = useI18n();
  const { issues, projects, customers, loading } = useIssueBoardData(["/dashboard"]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-sm text-zinc-600 dark:text-zinc-400 shadow-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <DashboardCharts issues={issues} projects={projects} customers={customers} />
  );
}
