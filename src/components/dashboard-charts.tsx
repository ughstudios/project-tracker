"use client";

import { useI18n } from "@/i18n/context";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AssigneeSlice = { id: string; name: string; count: number };
type StatusSlice = { key: string; name: string; count: number; fill: string };
type ProjectSlice = { id: string; name: string; count: number };

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  IN_PROGRESS: "#eab308",
  DONE: "#22c55e",
};

type ChartIssue = {
  status: string;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string; product: string } | null;
};

type ChartProject = {
  id: string;
  name: string;
  customer?: { id: string; name: string };
};

type Props = {
  issues: ChartIssue[];
  projects: ChartProject[];
  customers: { id: string }[];
};

export function DashboardCharts({ issues, projects, customers }: Props) {
  const { t } = useI18n();

  const { byAssignee, byStatus, byProject } = useMemo(() => {
    const labelForStatus = (key: string) => {
      const tr = t(`issueStatus.${key}` as "issueStatus.OPEN");
      return tr === `issueStatus.${key}` ? key : tr;
    };

    const assigneeMap = new Map<string, AssigneeSlice>();
    for (const issue of issues) {
      const id = issue.assignee?.id ?? "";
      const name = issue.assignee?.name ?? t("dashboard.chartUnassigned");
      const prev = assigneeMap.get(id) ?? { id, name, count: 0 };
      prev.count += 1;
      assigneeMap.set(id, prev);
    }
    const byAssignee = [...assigneeMap.values()].sort((a, b) => b.count - a.count);

    const statusOrder = ["OPEN", "IN_PROGRESS", "DONE"] as const;
    const statusCounts = new Map<string, number>();
    for (const issue of issues) {
      statusCounts.set(issue.status, (statusCounts.get(issue.status) ?? 0) + 1);
    }
    const otherKeys = [...statusCounts.keys()]
      .filter((k) => !statusOrder.includes(k as (typeof statusOrder)[number]))
      .sort();
    const byStatus: StatusSlice[] = [
      ...statusOrder
        .filter((k) => (statusCounts.get(k) ?? 0) > 0)
        .map((key) => ({
          key,
          name: labelForStatus(key),
          count: statusCounts.get(key) ?? 0,
          fill: STATUS_COLORS[key] ?? "#71717a",
        })),
      ...otherKeys.map((key) => ({
        key,
        name: labelForStatus(key),
        count: statusCounts.get(key) ?? 0,
        fill: "#a1a1aa",
      })),
    ];

    const projectMap = new Map<string, ProjectSlice>();
    for (const issue of issues) {
      if (issue.project) {
        const prev = projectMap.get(issue.project.id) ?? {
          id: issue.project.id,
          name: issue.project.name,
          count: 0,
        };
        prev.count += 1;
        projectMap.set(issue.project.id, prev);
      }
    }
    const byProject = [...projectMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return { byAssignee, byStatus, byProject };
  }, [issues, t]);

  const tooltipStyle = {
    backgroundColor: "white",
    border: "1px solid #e4e4e7",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <div className="space-y-4">
      <section
        aria-label={t("dashboard.chartsOverviewAria")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("dashboard.statActiveIssues")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{issues.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("dashboard.statProjects")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{projects.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("dashboard.statCustomers")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {customers.length}
          </p>
        </div>
      </section>

      {issues.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
          {t("dashboard.chartsNoIssues")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-800">{t("dashboard.chartByAssignee")}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{t("dashboard.chartByAssigneeHint")}</p>
            <div className="mt-3 h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={byAssignee}
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                  />
                  <Bar dataKey="count" name={t("dashboard.axisIssues")} fill="#52525b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-800">{t("dashboard.chartByStatus")}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{t("dashboard.chartByStatusHint")}</p>
            <div className="mt-3 h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {byStatus.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {byProject.length > 0 ? (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-semibold text-zinc-800">{t("dashboard.chartByProject")}</h3>
              <p className="mt-0.5 text-xs text-zinc-500">{t("dashboard.chartByProjectHint")}</p>
              <div className="mt-3 h-[300px] w-full min-w-0 md:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={byProject}
                    margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                    />
                    <Bar
                      dataKey="count"
                      name={t("dashboard.axisIssues")}
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
