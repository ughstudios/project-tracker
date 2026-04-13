"use client";

import { useI18n } from "@/i18n/context";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fetchFresh: RequestInit = { credentials: "include", cache: "no-store" };

type Summary = {
  byUser: { userId: string; name: string; count: number }[];
  byMonth: { monthKey: string; count: number }[];
};

export function WorkRecordsDashboardCharts() {
  const { t, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/work-records/dashboard-summary", fetchFresh);
      if (!res.ok) {
        setSummary(null);
        return;
      }
      setSummary((await res.json()) as Summary);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = useMemo(
    () => (monthKey: string) => {
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

  const byMonthLabeled = useMemo(() => {
    if (!summary) return [];
    return summary.byMonth.map((row) => ({
      ...row,
      label: monthLabel(row.monthKey),
    }));
  }, [summary, monthLabel]);

  const chartChrome = useMemo(() => {
    const dark = resolvedTheme === "dark";
    return {
      gridStroke: dark ? "#3f3f46" : "#e4e4e7",
      tooltipStyle: {
        backgroundColor: dark ? "#18181b" : "white",
        border: dark ? "1px solid #3f3f46" : "1px solid #e4e4e7",
        borderRadius: "8px",
        fontSize: "12px",
        color: dark ? "#fafafa" : "#18181b",
      } as const,
    };
  }, [resolvedTheme]);

  return (
    <section
      className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
      aria-label={t("dashboard.workRecordsChartsAria")}
    >
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("dashboard.workRecordsChartsTitle")}</h2>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t("dashboard.workRecordsChartsHint")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("common.loading")}</p>
      ) : !summary || (summary.byUser.length === 0 && summary.byMonth.every((m) => m.count === 0)) ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("dashboard.workRecordsChartsEmpty")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {summary.byUser.length > 0 ? (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
              <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {t("dashboard.chartWorkRecordsByAuthor")}
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{t("dashboard.chartWorkRecordsByAuthorHint")}</p>
              <div className="mt-2 h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={summary.byUser}
                    margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.gridStroke} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={chartChrome.tooltipStyle}
                      formatter={(value: number) => [value, t("dashboard.axisWorkRecords")]}
                    />
                    <Bar
                      dataKey="count"
                      name={t("dashboard.axisWorkRecords")}
                      fill="#b45309"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {t("dashboard.chartWorkRecordsByMonth")}
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{t("dashboard.chartWorkRecordsByMonthHint")}</p>
            <div className="mt-2 h-[240px] w-full min-w-0 lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonthLabeled} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.gridStroke} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={56} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={chartChrome.tooltipStyle}
                    formatter={(value: number) => [value, t("dashboard.axisWorkRecords")]}
                  />
                  <Bar
                    dataKey="count"
                    name={t("dashboard.axisWorkRecords")}
                    fill="#ca8a04"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
