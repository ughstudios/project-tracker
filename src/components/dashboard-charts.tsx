"use client";

import { WorkRecordsDashboardCharts } from "@/components/work-records-dashboard-charts";
import { useI18n } from "@/i18n/context";
import { getDashboardChartChrome } from "@/lib/dashboard-chart-theme";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";

type AssigneeSlice = { id: string; name: string; count: number };
type StatusSlice = { key: string; name: string; count: number; fill: string };

const CUSTOMER_PROJECT_TREEMAP_PARENT_FILLS = [
  "#4f46e5",
  "#7c3aed",
  "#0d9488",
  "#c2410c",
  "#be185d",
  "#1d4ed8",
  "#6d28d9",
  "#0f766e",
];
const CUSTOMER_PROJECT_TREEMAP_CHILD_FILLS = [
  "#c7d2fe",
  "#ddd6fe",
  "#99f6e4",
  "#fed7aa",
  "#fbcfe8",
  "#bfdbfe",
  "#e9d5ff",
  "#ccfbf1",
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  IN_PROGRESS: "#eab308",
  DONE: "#22c55e",
};

type ChartIssue = {
  status: string;
  createdAt: string;
  assignees: { id: string; name: string }[];
  project: { id: string; name: string; product: string } | null;
  customer: { id: string; name: string } | null;
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

function utcMonthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function DashboardCharts({ issues, assigneeLeaderboardIssues, projects, customers }: Props) {
  const { t, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const router = useRouter();

  const assigneeSource = assigneeLeaderboardIssues ?? issues;

  const { byAssignee, byAssigneeOpenWork, byStatus } = useMemo(() => {
    const labelForStatus = (key: string) => {
      const tr = t(`issueStatus.${key}` as "issueStatus.OPEN");
      return tr === `issueStatus.${key}` ? key : tr;
    };

    const countByAssignee = (source: ChartIssue[]): AssigneeSlice[] => {
      const assigneeMap = new Map<string, AssigneeSlice>();
      for (const issue of source) {
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
      return [...assigneeMap.values()].sort((a, b) => b.count - a.count);
    };

    const byAssignee = countByAssignee(assigneeSource);
    const openWorkIssues = issues.filter((i) => i.status !== "DONE");
    const byAssigneeOpenWork = countByAssignee(openWorkIssues);

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

    return { byAssignee, byAssigneeOpenWork, byStatus };
  }, [issues, assigneeSource, t]);

  type TreemapProjectNode = {
    name: string;
    value: number;
    projectId: string;
    customerId: string;
  };
  type TreemapCustomerNode = {
    name: string;
    customerId: string;
    children: TreemapProjectNode[];
  };

  const customerProjectTreemapData = useMemo((): TreemapCustomerNode[] => {
    const projectLookup = new Map(projects.map((p) => [p.id, p]));
    const noCustomerLabel = t("dashboard.treemapNoCustomer");
    const noProjectLabel = t("issues.noProject");

    type Acc = {
      customerName: string;
      projects: Map<string, { name: string; value: number; projectId: string }>;
    };
    const buckets = new Map<string, Acc>();

    for (const issue of issues) {
      let customerId: string;
      let customerName: string;
      if (issue.customer) {
        customerId = issue.customer.id;
        customerName = issue.customer.name;
      } else if (issue.project) {
        const meta = projectLookup.get(issue.project.id);
        if (meta?.customer) {
          customerId = meta.customer.id;
          customerName = meta.customer.name;
        } else {
          customerId = "";
          customerName = noCustomerLabel;
        }
      } else {
        customerId = "";
        customerName = noCustomerLabel;
      }

      const projectId = issue.project?.id ?? "__none__";
      const projectName = issue.project?.name ?? noProjectLabel;

      let acc = buckets.get(customerId);
      if (!acc) {
        acc = { customerName, projects: new Map() };
        buckets.set(customerId, acc);
      }
      let proj = acc.projects.get(projectId);
      if (!proj) {
        proj = { name: projectName, value: 0, projectId };
        acc.projects.set(projectId, proj);
      }
      proj.value += 1;
    }

    const sumChildren = (c: TreemapCustomerNode) => c.children.reduce((s, x) => s + x.value, 0);

    const rows: TreemapCustomerNode[] = [...buckets.entries()].map(([cid, acc]) => ({
      name: acc.customerName,
      customerId: cid,
      children: [...acc.projects.values()]
        .sort((a, b) => b.value - a.value)
        .slice(0, 14)
        .map((p) => ({
          name: p.name,
          value: p.value,
          projectId: p.projectId,
          customerId: cid,
        })),
    }));

    return rows
      .filter((r) => r.children.length > 0)
      .sort((a, b) => sumChildren(b) - sumChildren(a))
      .slice(0, 12);
  }, [issues, projects, t]);

  const monthLabel = useCallback(
    (monthKey: string) => {
      const [y, m] = monthKey.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1, 1));
      return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    },
    [locale],
  );

  const issuesByMonth = useMemo(() => {
    const now = new Date();
    const endY = now.getUTCFullYear();
    const endM = now.getUTCMonth();
    const keys: string[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      keys.push(utcMonthKey(new Date(Date.UTC(endY, endM - i, 1))));
    }
    const windowKeys = new Set(keys);
    const counts = new Map<string, number>();
    for (const issue of assigneeSource) {
      const raw = issue.createdAt;
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = utcMonthKey(d);
      if (!windowKeys.has(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return keys.map((monthKey) => ({
      monthKey,
      label: monthLabel(monthKey),
      count: counts.get(monthKey) ?? 0,
    }));
  }, [assigneeSource, monthLabel]);

  const chartChrome = useMemo(() => getDashboardChartChrome(resolvedTheme), [resolvedTheme]);

  const goToProjectIssues = useCallback(
    (projectId: string) => {
      router.push(`/issues?project=${encodeURIComponent(projectId)}`);
    },
    [router],
  );

  const goToCustomerIssues = useCallback(
    (customerId: string) => {
      router.push(`/issues?customer=${encodeURIComponent(customerId)}`);
    },
    [router],
  );

  const onCustomerProjectTreemapClick = useCallback(
    (node: { projectId?: string; customerId?: string; children?: unknown[] | null }) => {
      if (node.children && node.children.length > 0) return;
      const pid = node.projectId;
      const cid = node.customerId ?? "";
      if (typeof pid === "string" && pid && pid !== "__none__") goToProjectIssues(pid);
      else if (pid === "__none__" && cid) goToCustomerIssues(cid);
    },
    [goToCustomerIssues, goToProjectIssues],
  );

  const renderCustomerProjectTreemapNode = useCallback(
    (props: Record<string, unknown>) => {
      const depth = Number(props.depth ?? 0);
      if (depth === 0) return <g />;

      const x = Number(props.x);
      const y = Number(props.y);
      const w = Number(props.width);
      const h = Number(props.height);
      const name = String(props.name ?? "");
      const index = Number(props.index) || 0;
      const rawChildren = props.children;
      const isBranch = Array.isArray(rawChildren) && rawChildren.length > 0;
      const fill = isBranch
        ? CUSTOMER_PROJECT_TREEMAP_PARENT_FILLS[index % CUSTOMER_PROJECT_TREEMAP_PARENT_FILLS.length]
        : CUSTOMER_PROJECT_TREEMAP_CHILD_FILLS[index % CUSTOMER_PROJECT_TREEMAP_CHILD_FILLS.length];
      const label =
        name.length > 28 && (w < 120 || name.length > 36) ? `${name.slice(0, 26)}…` : name;
      const textFill = isBranch ? "#fafafa" : "#0f172a";
      const fontSize = w < 72 ? 10 : 11;
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={fill}
            stroke={chartChrome.pieStroke}
            strokeWidth={1}
            rx={2}
            ry={2}
          />
          {w > 32 && h > 16 ? (
            <text
              x={x + 6}
              y={y + h / 2 + 4}
              fill={textFill}
              fontSize={fontSize}
              fontWeight={isBranch ? 600 : 500}
            >
              {label}
            </text>
          ) : null}
        </g>
      );
    },
    [chartChrome.pieStroke],
  );

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
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel-surface rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {t("dashboard.chartByAssigneeOpenWork")}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {t("dashboard.chartByAssigneeOpenWorkHint")}
              </p>
              {byAssigneeOpenWork.length === 0 ? (
                <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {t("dashboard.chartByAssigneeOpenWorkEmpty")}
                </p>
              ) : (
                <div className="mt-3 h-[280px] w-full min-w-0 md:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={byAssigneeOpenWork}
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
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                        activeBar={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="panel-surface rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("dashboard.chartByAssignee")}</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.chartByAssigneeHint")}</p>
              <div className="mt-3 h-[280px] w-full min-w-0 md:h-[320px]">
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
          </div>

          {customerProjectTreemapData.length > 0 ? (
            <section className="panel-surface rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {t("dashboard.chartCustomerProjectTreemap")}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {t("dashboard.chartCustomerProjectTreemapHint")}
              </p>
              <div className="mt-3 h-[360px] w-full min-w-0 md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={customerProjectTreemapData}
                    dataKey="value"
                    type="nest"
                    stroke={chartChrome.pieStroke}
                    aspectRatio={4 / 3}
                    isAnimationActive={false}
                    isUpdateAnimationActive={false}
                    content={renderCustomerProjectTreemapNode as unknown as ReactElement}
                    onClick={onCustomerProjectTreemapClick}
                  >
                    <Tooltip
                      contentStyle={chartChrome.tooltipContentStyle}
                      labelStyle={chartChrome.tooltipLabelStyle}
                      itemStyle={chartChrome.tooltipItemStyle}
                      formatter={(value: number) => [value, t("dashboard.axisIssues")]}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <section className="panel-surface rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("dashboard.chartIssuesByMonth")}</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.chartIssuesByMonthHint")}</p>
            <div className="mt-3 h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issuesByMonth} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: chartChrome.tickFill }}
                    stroke={chartChrome.axisStroke}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartChrome.tickFill }}
                    stroke={chartChrome.axisStroke}
                    allowDecimals={false}
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
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
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
      )}

      <WorkRecordsDashboardCharts />
    </div>
  );
}
