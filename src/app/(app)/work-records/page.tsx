"use client";

import { useI18n } from "@/i18n/context";
import { isPrivilegedAdmin } from "@/lib/roles";
import { useCallback, useEffect, useState } from "react";

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

export default function WorkRecordsPage() {
  const { t } = useI18n();
  const [records, setRecords] = useState<WorkRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>("");

  const [formDate, setFormDate] = useState(() => toDateInputValue(new Date().toISOString()));
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs =
      isAdmin && filterUserId ? `?forUserId=${encodeURIComponent(filterUserId)}` : "";
    const res = await fetch(`/api/work-records${qs}`);
    if (!res.ok) {
      setError(t("workRecords.couldNotLoad"));
      setRecords([]);
      setLoading(false);
      return;
    }
    setRecords(await res.json());
    setLoading(false);
  }, [filterUserId, isAdmin, t]);

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
    void loadRecords();
  }, [loadRecords]);

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
    void loadRecords();
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
    void loadRecords();
  }

  async function onDelete(id: string) {
    if (!window.confirm(t("workRecords.deleteConfirm"))) return;
    setError(null);
    const res = await fetch(`/api/work-records/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(t("workRecords.couldNotDelete"));
      return;
    }
    void loadRecords();
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("workRecords.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("workRecords.subtitle")}</p>
      </header>

      {isAdmin ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-zinc-700">{t("workRecords.adminFilter")}</span>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800">{t("workRecords.add")}</h2>
        <form onSubmit={onCreate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600">
              {t("workRecords.workDate")}
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600">
              {t("workRecords.recordTitle")}{" "}
              <span className="font-normal text-zinc-400">({t("workRecords.optional")})</span>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-zinc-600">
            {t("workRecords.content")}
            <textarea
              required
              rows={4}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {submitting ? t("workRecords.adding") : t("workRecords.add")}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-zinc-600">{t("common.loading")}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("workRecords.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600">
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
                  <tr key={row.id} className="border-b border-zinc-100 align-top">
                    <td className="px-2 py-2">
                      {editingId === row.id ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full rounded border border-zinc-300 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        new Date(row.workDate).toLocaleDateString()
                      )}
                    </td>
                    {isAdmin ? (
                      <td className="px-2 py-2 text-zinc-700">
                        {row.user?.name ?? row.user?.email ?? t("common.unknown")}
                      </td>
                    ) : null}
                    <td className="px-2 py-2">
                      {editingId === row.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded border border-zinc-300 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        row.title || "—"
                      )}
                    </td>
                    <td className="max-w-md px-2 py-2 whitespace-pre-wrap text-zinc-800">
                      {editingId === row.id ? (
                        <textarea
                          rows={3}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded border border-zinc-300 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        row.content
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {editingId === row.id ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => void onSaveEdit(row.id)}
                            disabled={savingId === row.id}
                            className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                          >
                            {savingId === row.id ? t("workRecords.saving") : t("workRecords.save")}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            {t("workRecords.cancel")}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            {t("workRecords.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(row.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
