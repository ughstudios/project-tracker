"use client";

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

export default function ReportsPage() {
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [outstandingMonth, setOutstandingMonth] = useState(currentYearMonth);
  const [wrFrom, setWrFrom] = useState(monthRangeDefaults().from);
  const [wrTo, setWrTo] = useState(monthRangeDefaults().to);
  const [wrForUserId, setWrForUserId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!isAdmin) return;
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
    setError(null);
    setBusy("outstanding");
    try {
      const res = await fetch(
        `/api/reports/outstanding-issues?month=${encodeURIComponent(outstandingMonth)}`,
      );
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
  }, [outstandingMonth, t]);

  const downloadWorkRecords = useCallback(async () => {
    setError(null);
    setBusy("workRecords");
    try {
      const params = new URLSearchParams({ from: wrFrom, to: wrTo });
      if (isAdmin && wrForUserId) params.set("forUserId", wrForUserId);
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
  }, [wrFrom, wrTo, wrForUserId, isAdmin, t]);

  const downloadExportAll = useCallback(async () => {
    setError(null);
    setBusy("exportAll");
    try {
      const res = await fetch("/api/reports/export-all");
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
  }, [t]);

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{t("reports.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("reports.subtitle")}</p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

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
            disabled={busy !== null}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "outstanding" ? t("reports.preparing") : t("reports.downloadCsv")}
          </button>
        </div>
      </section>

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
          {isAdmin ? (
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
            disabled={busy !== null}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "workRecords" ? t("reports.preparing") : t("reports.downloadCsv")}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {!isAdmin ? t("reports.workRecordsSelfNote") : null}
          {isAdmin && wrForUserId === "" ? t("reports.workRecordsAdminSelfNote") : null}
          {isAdmin && wrForUserId === "__all__" ? t("reports.workRecordsAdminAllNote") : null}
          {isAdmin && wrForUserId !== "" && wrForUserId !== "__all__"
            ? t("reports.workRecordsAdminOtherNote")
            : null}
        </p>
      </section>

      {isAdmin ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">{t("reports.exportAllTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("reports.exportAllHelp")}</p>
          <button
            type="button"
            onClick={() => void downloadExportAll()}
            disabled={busy !== null}
            className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "exportAll" ? t("reports.preparingAll") : t("reports.downloadAllCsv")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
