"use client";

import {
  DEFAULT_ISSUE_COLUMNS,
  DEFAULT_USER_COLUMNS,
  DEFAULT_WORK_COLUMNS,
  ISSUE_COLUMN_KEYS,
  ISSUE_ID_KEYS,
  USER_COLUMN_KEYS,
  USER_ID_KEYS,
  WORK_COLUMN_KEYS,
  WORK_ID_KEYS,
  type IssueColumnKey,
  type UserColumnKey,
  type WorkColumnKey,
} from "@/lib/report-column-defs";
import { useI18n } from "@/i18n/context";
import { isPrivilegedAdmin } from "@/lib/roles";
import { useCallback, useEffect, useState } from "react";

type UserOption = { id: string; name: string; email: string; role: string };

function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRangeDefaults(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const mo = d.getMonth();
  const from = `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, mo + 1, 0).getDate();
  const to = `${y}-${String(mo + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function downloadCsv(filename: string, csvBody: string) {
  const body = csvBody.startsWith("\uFEFF") ? csvBody : `\uFEFF${csvBody}`;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toggleOrdered<T extends string>(canonical: readonly T[], current: T[], key: T): T[] {
  const set = new Set(current);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return canonical.filter((k) => set.has(k));
}

function ColumnGroup<T extends string>({
  title,
  canonical,
  selected,
  onChange,
  labelPrefix,
  excludeFromBulkAll,
  t,
}: {
  title: string;
  canonical: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  labelPrefix: "reports.columnsIssue" | "reports.columnsWork" | "reports.columnsUser";
  /** Omitted when using “select all recommended” (e.g. internal IDs). */
  excludeFromBulkAll?: Set<string>;
  t: (k: string) => string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        <button
          type="button"
          onClick={() =>
            onChange(canonical.filter((k) => !excludeFromBulkAll?.has(k)) as T[])
          }
          className="text-xs font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          {t("reports.selectAllCols")}
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          {t("reports.clearCols")}
        </button>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
        {canonical.map((key) => {
          const checked = selected.includes(key);
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-zinc-800 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(toggleOrdered(canonical, selected, key))}
                  className="rounded border-zinc-300 text-zinc-900"
                />
                <span>{t(`${labelPrefix}.${key}`)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [outstandingMonth, setOutstandingMonth] = useState(currentYearMonth);
  const [wrFrom, setWrFrom] = useState(monthRangeDefaults().from);
  const [wrTo, setWrTo] = useState(monthRangeDefaults().to);
  const [wrForUserId, setWrForUserId] = useState("");
  const [issueCols, setIssueCols] = useState<IssueColumnKey[]>(() => [...DEFAULT_ISSUE_COLUMNS]);
  const [workCols, setWorkCols] = useState<WorkColumnKey[]>(() => [...DEFAULT_WORK_COLUMNS]);
  const [userCols, setUserCols] = useState<UserColumnKey[]>(() => [...DEFAULT_USER_COLUMNS]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showColsWarning =
    workCols.length === 0 ||
    (isAdmin === true && (issueCols.length === 0 || userCols.length === 0));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok || cancelled) return;
      const me = (await res.json()) as { role?: string };
      setIsAdmin(isPrivilegedAdmin(me.role));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAdmin !== true) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/users");
      if (!res.ok || cancelled) return;
      const list = (await res.json()) as UserOption[];
      if (!cancelled) setUsers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const downloadOutstanding = useCallback(async () => {
    if (issueCols.length === 0) {
      setError(t("reports.needOneColumn"));
      return;
    }
    setError(null);
    setBusy("outstanding");
    try {
      const q = new URLSearchParams({
        month: outstandingMonth,
        issueCols: issueCols.join(","),
      });
      const res = await fetch(`/api/reports/outstanding-issues?${q}`);
      if (res.status === 403) {
        setError(t("reports.adminOnlyIssues"));
        return;
      }
      if (!res.ok) {
        setError(t("reports.downloadFailed"));
        return;
      }
      const text = await res.text();
      const safeMonth = outstandingMonth.replace(/[^\d-]/g, "") || "report";
      downloadCsv(`outstanding-issues-${safeMonth}.csv`, text);
    } finally {
      setBusy(null);
    }
  }, [outstandingMonth, issueCols, t]);

  const downloadWorkRecords = useCallback(async () => {
    if (workCols.length === 0) {
      setError(t("reports.needOneColumn"));
      return;
    }
    setError(null);
    setBusy("workRecords");
    try {
      const params = new URLSearchParams({
        from: wrFrom,
        to: wrTo,
        workCols: workCols.join(","),
      });
      if (isAdmin === true && wrForUserId) params.set("forUserId", wrForUserId);
      const res = await fetch(`/api/reports/work-records-export?${params}`);
      if (!res.ok) {
        setError(t("reports.downloadFailed"));
        return;
      }
      const text = await res.text();
      const slug = `${wrFrom}_to_${wrTo}`.replace(/[^\d_-]/g, "");
      downloadCsv(`work-records-${slug}.csv`, text);
    } finally {
      setBusy(null);
    }
  }, [wrFrom, wrTo, wrForUserId, isAdmin, workCols, t]);

  const downloadExportAll = useCallback(async () => {
    if (issueCols.length === 0 || workCols.length === 0 || userCols.length === 0) {
      setError(t("reports.needOneColumn"));
      return;
    }
    setError(null);
    setBusy("exportAll");
    try {
      const q = new URLSearchParams({
        issueCols: issueCols.join(","),
        workCols: workCols.join(","),
        userCols: userCols.join(","),
      });
      const res = await fetch(`/api/reports/export-all?${q}`);
      if (res.status === 403) {
        setError(t("reports.forbidden"));
        return;
      }
      if (!res.ok) {
        setError(t("reports.downloadFailed"));
        return;
      }
      const data = (await res.json()) as { files?: Record<string, string> };
      const files = data.files;
      if (!files || typeof files !== "object") {
        setError(t("reports.downloadFailed"));
        return;
      }
      const entries = Object.entries(files);
      for (let i = 0; i < entries.length; i++) {
        const [name, content] = entries[i];
        downloadCsv(name, content);
        if (i < entries.length - 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } finally {
      setBusy(null);
    }
  }, [issueCols, workCols, userCols, t]);

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{t("reports.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {isAdmin === null
            ? t("common.loading")
            : isAdmin
              ? t("reports.subtitle")
              : t("reports.subtitleEmployee")}
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">{t("reports.csvOptionsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {isAdmin === null
            ? t("common.loading")
            : isAdmin
              ? t("reports.csvOptionsHelp")
              : t("reports.csvOptionsHelpEmployee")}
        </p>
        <p className="mt-3 text-xs text-zinc-500">{t("reports.idColumnsHint")}</p>

        <div className="mt-6 flex flex-col gap-6 border-t border-zinc-100 pt-6">
          {isAdmin === true ? (
            <ColumnGroup
              title={t("reports.pickIssueCols")}
              canonical={ISSUE_COLUMN_KEYS}
              selected={issueCols}
              onChange={(next) => setIssueCols(next as IssueColumnKey[])}
              labelPrefix="reports.columnsIssue"
              excludeFromBulkAll={ISSUE_ID_KEYS}
              t={t}
            />
          ) : null}
          <ColumnGroup
            title={t("reports.pickWorkCols")}
            canonical={WORK_COLUMN_KEYS}
            selected={workCols}
            onChange={(next) => setWorkCols(next as WorkColumnKey[])}
            labelPrefix="reports.columnsWork"
            excludeFromBulkAll={WORK_ID_KEYS}
            t={t}
          />
          {isAdmin === true ? (
            <ColumnGroup
              title={t("reports.pickUserCols")}
              canonical={USER_COLUMN_KEYS}
              selected={userCols}
              onChange={(next) => setUserCols(next as UserColumnKey[])}
              labelPrefix="reports.columnsUser"
              excludeFromBulkAll={USER_ID_KEYS}
              t={t}
            />
          ) : null}
        </div>
        {showColsWarning ? (
          <p className="mt-4 text-sm text-amber-800">{t("reports.needOneColumn")}</p>
        ) : null}
      </section>

      {isAdmin === true ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">{t("reports.outstandingTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("reports.outstandingHelp")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              {t("reports.month")}
              <input
                type="month"
                value={outstandingMonth}
                onChange={(e) => setOutstandingMonth(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>
            <button
              type="button"
              onClick={() => void downloadOutstanding()}
              disabled={busy !== null || issueCols.length === 0}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "outstanding" ? t("reports.preparing") : t("reports.downloadCsv")}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">{t("reports.workRecordsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("reports.workRecordsHelp")}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            {t("reports.fromDate")}
            <input
              type="date"
              value={wrFrom}
              onChange={(e) => setWrFrom(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            {t("reports.toDate")}
            <input
              type="date"
              value={wrTo}
              onChange={(e) => setWrTo(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>
          {isAdmin === true ? (
            <label className="flex min-w-[200px] flex-col gap-1 text-xs font-medium text-zinc-600">
              {t("reports.personOptional")}
              <select
                value={wrForUserId}
                onChange={(e) => setWrForUserId(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
              >
                <option value="">{t("reports.selfOnly")}</option>
                <option value="__all__">{t("reports.everyoneInRange")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void downloadWorkRecords()}
            disabled={busy !== null || workCols.length === 0}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "workRecords" ? t("reports.preparing") : t("reports.downloadCsv")}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {isAdmin === false ? t("reports.workRecordsSelfNote") : null}
          {isAdmin === true && wrForUserId === "" ? t("reports.workRecordsAdminSelfNote") : null}
          {isAdmin === true && wrForUserId === "__all__" ? t("reports.workRecordsAdminAllNote") : null}
          {isAdmin === true && wrForUserId !== "" && wrForUserId !== "__all__"
            ? t("reports.workRecordsAdminOtherNote")
            : null}
        </p>
      </section>

      {isAdmin === true ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">{t("reports.exportAllTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("reports.exportAllHelp")}</p>
          <button
            type="button"
            onClick={() => void downloadExportAll()}
            disabled={
              busy !== null || issueCols.length === 0 || workCols.length === 0 || userCols.length === 0
            }
            className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "exportAll" ? t("reports.preparingAll") : t("reports.downloadAllCsv")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
