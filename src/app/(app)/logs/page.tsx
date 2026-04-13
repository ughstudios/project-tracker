"use client";

import { useI18n } from "@/i18n/context";
import { useCallback, useEffect, useState } from "react";

type LogItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  actor?: { id: string; name: string | null; email: string | null } | null;
};

const LOGS_PAGE_SIZE = 25;

export default function LogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPage = useCallback(
    async (forPage: number) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", String(forPage));
      params.set("pageSize", String(LOGS_PAGE_SIZE));
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) {
        setError(t("logs.couldNotLoad"));
        setLogs([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        logs: LogItem[];
        total: number;
        page: number;
        totalPages: number;
      };
      setLogs(data.logs);
      setTotal(data.total);
      setPage(data.page);
      setLoading(false);
    },
    [t],
  );

  useEffect(() => {
    void fetchPage(page);
  }, [page, fetchPage]);

  const totalPages = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("logs.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("logs.subtitle")}</p>
      </header>

      <section className="panel-surface rounded-xl p-4">
        {error ? (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("common.loadingLogs")}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("logs.none")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-white/[0.08] dark:text-zinc-300">
                    <th className="px-2 py-2 font-medium">{t("common.when")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.actor")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.action")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.entity")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.details")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.updatedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-zinc-100 align-top hover:bg-zinc-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04]"
                    >
                      <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                        {log.actor?.name ?? log.actor?.email ?? t("common.unknown")}
                      </td>
                      <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">{log.action}</td>
                      <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                        {log.entityType} ({log.entityId})
                      </td>
                      <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">{log.description}</td>
                      <td className="px-2 py-2 text-zinc-800 dark:text-zinc-200">
                        {new Date(log.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && total > 0 && totalPages > 1 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3 dark:border-white/[0.08]">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("logs.pageSummary", {
                    page: String(page),
                    totalPages: String(totalPages),
                    total: String(total),
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-secondary rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
