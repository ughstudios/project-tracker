"use client";

import { WorkRecordsDashboardCharts } from "@/components/work-records-dashboard-charts";
import { useI18n } from "@/i18n/context";
import { getDashboardChartChrome } from "@/lib/dashboard-chart-theme";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AssigneeSlice = { id: string; name: string; count: number };
type StatusSlice = { key: string; name: string; count: number; fill: string };
type CustomerIssueSlice = {
  id: string;
  name: string;
  count: number;
  dataKey: string;
  fill: string;
};
type CustomerMonthlyDatum = {
  monthKey: string;
  label: string;
} & Record<string, string | number>;

type CustomerMonthlySeriesSlice = {
  id: string;
  dataKey: string;
  name: string;
  fill: string;
};

/** Stacked monthly chart: at most this many customers get their own series; the rest roll into "Other". */
const MONTHLY_STACK_TOP = 7;
const OTHER_MONTHLY_KEY = "customer_month_other";

const CUSTOMER_CHART_COLORS = [
  "#4f46e5",
  "#7c3aed",
  "#0d9488",
  "#c2410c",
  "#be185d",
  "#1d4ed8",
  "#6d28d9",
  "#0f766e",
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

function recentUtcMonthKeys(count: number): string[] {
  const now = new Date();
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(utcMonthKey(new Date(Date.UTC(endY, endM - i, 1))));
  }
  return keys;
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

  const { byCustomer, customerMonthlyBreakdown, customerMonthlySeries } = useMemo(() => {
    const projectLookup = new Map(projects.map((p) => [p.id, p]));
    const noCustomerLabel = t("issues.noCustomer");
    const customerForIssue = (issue: ChartIssue) => {
      if (issue.customer) {
        return { id: issue.customer.id, name: issue.customer.name };
      }
      if (issue.project) {
        const project = projectLookup.get(issue.project.id);
        if (project?.customer) return { id: project.customer.id, name: project.customer.name };
      }
      return { id: "", name: noCustomerLabel };
    };

    const buckets = new Map<string, { id: string; name: string; count: number }>();
    for (const issue of issues) {
      const customer = customerForIssue(issue);
      const prev = buckets.get(customer.id) ?? { ...customer, count: 0 };
      prev.count += 1;
      buckets.set(customer.id, prev);
    }

    const sortedCustomers = [...buckets.values()].sort((a, b) => b.count - a.count);

    const byCustomer: CustomerIssueSlice[] = sortedCustomers.slice(0, 12).map((customer, index) => ({
      ...customer,
      dataKey: `customer_${index}`,
      fill: CUSTOMER_CHART_COLORS[index % CUSTOMER_CHART_COLORS.length],
    }));

    const topMonthly = sortedCustomers.slice(0, MONTHLY_STACK_TOP);
    const hasOther = sortedCustomers.length > MONTHLY_STACK_TOP;
    const idToMonthlyKey = new Map<string, string>();
    topMonthly.forEach((c, i) => {
      idToMonthlyKey.set(c.id, `monthly_customer_${i}`);
    });

    const customerMonthlySeries: CustomerMonthlySeriesSlice[] = topMonthly.map((c, i) => ({
      id: c.id,
      dataKey: `monthly_customer_${i}`,
      name: c.name,
      fill: CUSTOMER_CHART_COLORS[i % CUSTOMER_CHART_COLORS.length],
    }));
    if (hasOther) {
      customerMonthlySeries.push({
        id: "__other__",
        dataKey: OTHER_MONTHLY_KEY,
        name: t("dashboard.chartCustomerMonthlyOther"),
        fill: "#64748b",
      });
    }

    const monthKeys = recentUtcMonthKeys(12);
    const customerMonthlyBreakdown: CustomerMonthlyDatum[] = monthKeys.map((monthKey) => {
      const row: CustomerMonthlyDatum = { monthKey, label: monthLabel(monthKey) };
      for (const slice of customerMonthlySeries) row[slice.dataKey] = 0;
      return row;
    });
    const monthlyRowByKey = new Map(customerMonthlyBreakdown.map((row) => [row.monthKey, row]));

    for (const issue of issues) {
      const d = new Date(issue.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const row = monthlyRowByKey.get(utcMonthKey(d));
      if (!row) continue;
      const cid = customerForIssue(issue).id;
      const key = idToMonthlyKey.get(cid);
      if (key) {
        row[key] = Number(row[key] ?? 0) + 1;
      } else if (hasOther) {
        row[OTHER_MONTHLY_KEY] = Number(row[OTHER_MONTHLY_KEY] ?? 0) + 1;
      }
    }

    return { byCustomer, customerMonthlyBreakdown, customerMonthlySeries };
  }, [issues, projects, t, monthLabel]);

  const issuesByMonth = useMemo(() => {
    const keys = recentUtcMonthKeys(12);
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

  const goToCustomerIssues = useCallback(
    (customerId: string) => {
      router.push(`/issues?customer=${encodeURIComponent(customerId)}`);
    },
    [router],
  );

  const onCustomerBarClick = useCallback(
    (entry: unknown) => {
      const payload = (entry as { payload?: CustomerIssueSlice }).payload;
      if (payload?.id) goToCustomerIssues(payload.id);
    },
    [goToCustomerIssues],
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

          {byCustomer.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="panel-surface rounded-xl p-4">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("dashboard.chartByCustomer")}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {t("dashboard.chartByCustomerHint")}
                </p>
                <div className="mt-3 h-[300px] w-full min-w-0 md:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={byCustomer}
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
                        width={116}
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
                        radius={[0, 4, 4, 0]}
                        activeBar={false}
                        onClick={onCustomerBarClick}
                      >
                        {byCustomer.map((customer) => (
                          <Cell
                            key={customer.id || "__no_customer__"}
                            fill={customer.fill}
                            cursor={customer.id ? "pointer" : "default"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel-surface rounded-xl p-4">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("dashboard.chartByCustomerMonthly")}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {t("dashboard.chartByCustomerMonthlyHint")}
                </p>
                <div className="mt-3 h-[300px] w-full min-w-0 md:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerMonthlyBreakdown} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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
                        formatter={(value: number, name: string) => [value, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={52}
                        wrapperStyle={{ color: chartChrome.tickFill, fontSize: "10px" }}
                      />
                      {customerMonthlySeries.map((slice) => (
                        <Bar
                          key={slice.dataKey}
                          dataKey={slice.dataKey}
                          name={slice.name}
                          stackId="customers"
                          fill={slice.fill}
                          activeBar={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="panel-surface rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {t("dashboard.chartIssuesByMonth")}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {t("dashboard.chartIssuesByMonthHint")}
              </p>
              <div className="mt-3 h-[280px] w-full min-w-0">
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
        </div>
      )}

      <WorkRecordsDashboardCharts />
    </div>
  );
}
