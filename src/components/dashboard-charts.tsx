"use client";

import { WorkRecordsDashboardCharts } from "@/components/work-records-dashboard-charts";
import { useI18n } from "@/i18n/context";
import { getDashboardChartChrome } from "@/lib/dashboard-chart-theme";
import { useTheme } from "next-themes";
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
  assignees: { id: string; name: string }[];
  project: { id: string; name: string; product: string } | null;
};

type ChartProject = {
  id: string;
  name: string;
  customer?: { id: string; name: string };
};

type Props = {
  /** Non-archived issues: KPI, status, and project charts. */
  issues: ChartIssue[];
  /** All issues (including archived) for the assignee totals chart; defaults to `issues` when omitted. */
  assigneeLeaderboardIssues?: ChartIssue[];
  projects: ChartProject[];
  customers: { id: string }[];
};

export function DashboardCharts({ issues, assigneeLeaderboardIssues, projects, customers }: Props) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();

  const assigneeSource = assigneeLeaderboardIssues ?? issues;

  const { byAssignee, byStatus, byProject } = useMemo(() => {
    const labelForStatus = (key: string) => {
      const tr = t(`issueStatus.${key}` as "issueStatus.OPEN");
      return tr === `issueStatus.${key}` ? key : tr;
    };

    const assigneeMap = new Map<string, AssigneeSlice>();
    for (const issue of assigneeSource) {
      if (issue.assignees.length === 0) {
        const id = "";
        const name = t("dashboard.chartUnassigned");
        const prev = assigneeMap.get(id) ?? { id, name, count: 0 };
        prev.count += 1;
        assigneeMap.set(id, prev);
      } else {
        for (const a of issue.assignees) {
          const prev = assigneeMap.get(a.id) ?? { id: a.id, name: a.name, count: 0 };
          prev.count += 1;
          assigneeMap.set(a.id, prev);
        }
      }
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
  }, [issues, assigneeSource, t]);

  const chartChrome = useMemo(() => getDashboardChartChrome(resolvedTheme), [resolvedTheme]);

  return (
    <div className="space-y-4">
      <section
        aria-label={t("dashboard.chartsOverviewAria")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <div className="panel-surface rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("dashboard.statActiveIssues")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{issues.length}</p>
        </div>
        <div className="panel-surface rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("dashboard.statProjects")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{projects.length}</p>
        </div>
        <div className="panel-surface rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("dashboard.statCustomers")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {customers.length}
          </p>
        </div>
      </section>

      {issues.length === 0 && assigneeSource.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-950 p-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t("dashboard.chartsNoIssues")}
        </p>
      ) : (
        <div className="space-y-4">
          {byProject.length > 0 ? (
            <section className="panel-surface rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("dashboard.chartByProject")}</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.chartByProjectHint")}</p>
              <div className="mt-3 h-[300px] w-full min-w-0 md:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={byProject}
                    margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.gridStroke} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: chartChrome.tickFill }}
                      stroke={chartChrome.axisStroke}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11, fill: chartChrome.tickFill }}
                      stroke={chartChrome.axisStroke}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={chartChrome.tooltipContentStyle}
                      labelStyle={chartChrome.tooltipLabelStyle}
                      itemStyle={chartChrome.tooltipItemStyle}
                      cursor={{ fill: chartChrome.cursorFill }}
                      formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                    />
                    <Bar
                      dataKey="count"
                      name={t("dashboard.axisIssues")}
                      fill="#818cf8"
                      radius={[0, 4, 4, 0]}
                      activeBar={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <div
            className={
              byStatus.length > 0
                ? "grid gap-4 lg:grid-cols-2"
                : "grid gap-4 lg:grid-cols-1"
            }
          >
            <section className="panel-surface rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("dashboard.chartByAssignee")}</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.chartByAssigneeHint")}</p>
              <div className="mt-3 h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={byAssignee}
                    margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.gridStroke} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: chartChrome.tickFill }}
                      stroke={chartChrome.axisStroke}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11, fill: chartChrome.tickFill }}
                      stroke={chartChrome.axisStroke}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={chartChrome.tooltipContentStyle}
                      labelStyle={chartChrome.tooltipLabelStyle}
                      itemStyle={chartChrome.tooltipItemStyle}
                      cursor={{ fill: chartChrome.cursorFill }}
                      formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                    />
                    <Bar
                      dataKey="count"
                      name={t("dashboard.axisIssues")}
                      fill="#71717a"
                      radius={[0, 4, 4, 0]}
                      activeBar={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {byStatus.length > 0 ? (
              <section className="panel-surface rounded-xl p-4">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("dashboard.chartByStatus")}</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.chartByStatusHint")}</p>
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
                        stroke={chartChrome.pieStroke}
                        strokeWidth={1}
                        label={({ name, percent, cx, cy, midAngle, outerRadius, fill }) => {
                          const RADIAN = Math.PI / 180;
                          const or = outerRadius ?? 0;
                          const x = (cx ?? 0) + (or + 14) * Math.cos(-(midAngle ?? 0) * RADIAN);
                          const y = (cy ?? 0) + (or + 14) * Math.sin(-(midAngle ?? 0) * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={fill as string}
                              textAnchor={x > (cx ?? 0) ? "start" : "end"}
                              dominantBaseline="central"
                              fontSize={11}
                            >
                              {`${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            </text>
                          );
                        }}
                        labelLine={false}
                      >
                        {byStatus.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={chartChrome.tooltipContentStyle}
                        labelStyle={chartChrome.tooltipLabelStyle}
                        itemStyle={chartChrome.tooltipItemStyle}
                        formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}

      <WorkRecordsDashboardCharts />
    </div>
  );
}
