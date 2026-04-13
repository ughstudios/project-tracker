"use client";

import { WorkRecordContentView } from "@/components/work-record-content";
import { useI18n } from "@/i18n/context";
import { uploadWorkRecordPasteImages } from "@/lib/blob-client-upload";
import { isPrivilegedAdmin } from "@/lib/roles";
import { useCallback, useEffect, useState } from "react";

function imageFilesFromClipboard(e: React.ClipboardEvent): File[] {
  const items = e.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}

type WorkRecordRow = {
  id: string;
  workDate: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string | null };
};

type UserOption = { id: string; name: string; email: string; role: string };

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WORK_RECORDS_PAGE_SIZE = 10;

export default function WorkRecordsPage() {
  const { t } = useI18n();
  const [records, setRecords] = useState<WorkRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [formDate, setFormDate] = useState(() => toDateInputValue(new Date().toISOString()));
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);

  const fetchPage = useCallback(
    async (forPage: number | "last") => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", forPage === "last" ? "last" : String(forPage));
      params.set("pageSize", String(WORK_RECORDS_PAGE_SIZE));
      if (isAdmin && filterUserId) params.set("forUserId", filterUserId);
      const res = await fetch(`/api/work-records?${params}`);
      if (!res.ok) {
        setError(t("workRecords.couldNotLoad"));
        setRecords([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        records: WorkRecordRow[];
        total: number;
        page: number;
        totalPages: number;
      };
      setRecords(data.records);
      setTotal(data.total);
      setPage(data.page);
      setLoading(false);
    },
    [filterUserId, isAdmin, t],
  );

  useEffect(() => {
    const run = async () => {
      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const j = (await meRes.json()) as { role?: string };
        setIsAdmin(isPrivilegedAdmin(j.role));
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const run = async () => {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    };
    void run();
  }, [isAdmin]);

  useEffect(() => {
    void fetchPage(page);
  }, [page, filterUserId, isAdmin, fetchPage]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const workDate = formDate ? new Date(`${formDate}T12:00:00`).toISOString() : "";
    const res = await fetch("/api/work-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workDate,
        title: formTitle,
        content: formContent,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(t("workRecords.couldNotCreate"));
      return;
    }
    setFormTitle("");
    setFormContent("");
    void fetchPage(1);
  }

  function startEdit(row: WorkRecordRow) {
    setEditingId(row.id);
    setEditDate(toDateInputValue(row.workDate));
    setEditTitle(row.title);
    setEditContent(row.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setEditTitle("");
    setEditContent("");
  }

  async function onSaveEdit(id: string) {
    setSavingId(id);
    setError(null);
    const workDate = editDate ? new Date(`${editDate}T12:00:00`).toISOString() : "";
    const res = await fetch(`/api/work-records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workDate,
        title: editTitle,
        content: editContent,
      }),
    });
    setSavingId(null);
    if (!res.ok) {
      setError(t("workRecords.couldNotSave"));
      return;
    }
    cancelEdit();
    void fetchPage(page);
  }

  const handlePasteImages = useCallback(
    async (
      e: React.ClipboardEvent<HTMLTextAreaElement>,
      which: "form" | "edit",
    ) => {
      const files = imageFilesFromClipboard(e);
      if (files.length === 0) return;
      e.preventDefault();
      const ta = e.currentTarget;
      const snapshot = which === "form" ? formContent : editContent;
      const setContent = which === "form" ? setFormContent : setEditContent;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = snapshot.slice(0, start);
      const after = snapshot.slice(end);
      setPasteBusy(true);
      try {
        const up = await uploadWorkRecordPasteImages({
          files,
          onProgress: () => {},
        });
        if (!up.ok) {
          alert(up.error ?? t("workRecords.pasteUploadFailed"));
          return;
        }
        const insert = `${up.urls.map((u) => `![](${u})`).join("\n")}\n`;
        const next = before + insert + after;
        setContent(next);
        requestAnimationFrame(() => {
          const pos = start + insert.length;
          ta.focus();
          ta.setSelectionRange(pos, pos);
        });
      } finally {
        setPasteBusy(false);
      }
    },
    [editContent, formContent, t],
  );

  const totalPages = Math.max(1, Math.ceil(total / WORK_RECORDS_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold">{t("workRecords.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("workRecords.subtitle")}</p>
      </header>

      {isAdmin ? (
        <div className="panel-surface rounded-xl p-4">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("workRecords.adminFilter")}</span>
            <select
              value={filterUserId}
              onChange={(e) => {
                setFilterUserId(e.target.value);
                setPage(1);
              }}
              className="input max-w-md text-sm"
            >
              <option value="">{t("workRecords.everyone")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <section className="panel-surface rounded-xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("workRecords.add")}</h2>
        <form onSubmit={onCreate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {t("workRecords.workDate")}
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {t("workRecords.recordTitle")}{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">({t("workRecords.optional")})</span>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t("workRecords.content")}
            <p className="mt-0.5 font-normal text-zinc-500 dark:text-zinc-400">{t("workRecords.pasteImagesHint")}</p>
            <textarea
              required
              rows={4}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              onPaste={(e) => void handlePasteImages(e, "form")}
              disabled={pasteBusy || submitting}
              className="input mt-1 min-h-[5.5rem] w-full resize-y text-sm disabled:opacity-60"
            />
            {pasteBusy ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("workRecords.pasteUploading")}</p>
            ) : null}
          </label>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? t("workRecords.adding") : t("workRecords.add")}
          </button>
        </form>
      </section>

      <section className="panel-surface rounded-xl p-4">
        {loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("common.loading")}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("workRecords.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-white/[0.08] dark:text-zinc-400">
                  <th className="px-2 py-2 font-medium">{t("workRecords.workDate")}</th>
                  {isAdmin ? (
                    <th className="px-2 py-2 font-medium">{t("workRecords.owner")}</th>
                  ) : null}
                  <th className="px-2 py-2 font-medium">{t("workRecords.recordTitle")}</th>
                  <th className="px-2 py-2 font-medium">{t("workRecords.content")}</th>
                  <th className="px-2 py-2 font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 align-top dark:border-white/[0.06]">
                    <td className="px-2 py-2">
                      {editingId === row.id ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="input w-full py-1.5 text-xs"
                        />
                      ) : (
                        new Date(row.workDate).toLocaleDateString()
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">
                        {row.user?.name ?? row.user?.email ?? t("common.unknown")}
                      </td>
                    ) : null}
                    <td className="px-2 py-2">
                      {editingId === row.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="input w-full py-1.5 text-xs"
                        />
                      ) : (
                        row.title || "—"
                      )}
                    </td>
                    <td className="max-w-md px-2 py-2 text-zinc-800 dark:text-zinc-200">
                      {editingId === row.id ? (
                        <>
                          <p className="mb-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                            {t("workRecords.pasteImagesHint")}
                          </p>
                          <textarea
                            rows={3}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onPaste={(e) => void handlePasteImages(e, "edit")}
                            disabled={pasteBusy || savingId === row.id}
                            className="input min-h-[4rem] w-full resize-y py-1.5 text-xs disabled:opacity-60"
                          />
                          {pasteBusy ? (
                            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {t("workRecords.pasteUploading")}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <WorkRecordContentView content={row.content} />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {editingId === row.id ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => void onSaveEdit(row.id)}
                            disabled={savingId === row.id}
                            className="btn-primary rounded px-2 py-1 text-xs font-medium disabled:opacity-60"
                          >
                            {savingId === row.id ? t("workRecords.saving") : t("workRecords.save")}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                          >
                            {t("workRecords.cancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="btn-secondary rounded-md px-2.5 py-1 text-xs font-medium"
                        >
                          {t("workRecords.edit")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 0 && totalPages > 1 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-white/[0.08]">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("workRecords.pageSummary", {
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
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
              >
                {t("common.previous")}
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
