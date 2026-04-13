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
      <header className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("logs.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("logs.subtitle")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("common.loadingLogs")}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("logs.none")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.when")}</th>
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.actor")}</th>
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.action")}</th>
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.entity")}</th>
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.details")}</th>
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.updatedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="odd:bg-white dark:bg-zinc-900 dark:odd:bg-zinc-900 even:bg-zinc-50 dark:bg-zinc-950/50 dark:even:bg-zinc-800/40">
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                        {log.actor?.name ?? log.actor?.email ?? t("common.unknown")}
                      </td>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{log.action}</td>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                        {log.entityType} ({log.entityId})
                      </td>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{log.description}</td>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                        {new Date(log.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && total > 0 && totalPages > 1 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
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
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800 disabled:opacity-50"
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
