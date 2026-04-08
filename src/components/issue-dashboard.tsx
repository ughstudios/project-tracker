"use client";

import { DashboardCharts } from "@/components/dashboard-charts";
import { useIssueBoardData } from "@/hooks/use-issue-board-data";
import { useI18n } from "@/i18n/context";

export function IssueDashboard() {
  const { t } = useI18n();
  const { issues, projects, customers, loading } = useIssueBoardData(["/dashboard"]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        {t("common.loading")}
      </div>
    );
  }

  return <DashboardCharts issues={issues} projects={projects} customers={customers} />;
}
