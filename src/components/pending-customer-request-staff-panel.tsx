"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export type ThreadEntryProps = {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null; email: string | null };
};

export function PendingCustomerRequestStaffPanel({
  submissionId,
  initialStatus,
  initialClosedAtIso,
  initialThread,
}: {
  submissionId: string;
  initialStatus: string;
  initialClosedAtIso: string | null;
  initialThread: ThreadEntryProps[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [closedAtIso, setClosedAtIso] = useState<string | null>(initialClosedAtIso);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(next: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pending-customer-requests/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        closedAt?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update status.");
        return;
      }
      setStatus(data.status ?? next);
      setClosedAtIso(data.closedAt ?? null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function archiveNow() {
    if (!confirm("Archive this request now? It will leave this list and appear under Archive → Pending form requests.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pending-customer-requests/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveNow: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not archive.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitComment(e: FormEvent) {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pending-customer-requests/${submissionId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not post comment.");
        return;
      }
      setComment("");
      router.refresh();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Staff workflow</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Set status when done: <strong>Closed</strong> starts a 24-hour timer; the request then archives automatically
        (same behavior as completed issues). You can archive immediately at any time.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Status
          <select
            className="input min-w-[11rem] text-sm"
            value={status}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value;
              void patchStatus(v);
            }}
          >
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        {status === "CLOSED" && closedAtIso ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Closed {new Date(closedAtIso).toLocaleString()} · auto-archives 24h after this time
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void archiveNow()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Archive now
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Thread</h4>
        <ul className="mt-2 space-y-3">
          {initialThread.length === 0 ? (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">No comments yet.</li>
          ) : (
            initialThread.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {entry.author.name ?? entry.author.email ?? "User"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{entry.content}</p>
              </li>
            ))
          )}
        </ul>

        <form className="mt-4 space-y-2" onSubmit={(e) => void onSubmitComment(e)}>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Add comment</label>
          <textarea
            className="input min-h-[88px] w-full text-sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Internal notes visible to staff on this request…"
            disabled={posting}
          />
          <button
            type="submit"
            disabled={posting || !comment.trim()}
            className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {posting ? "Posting…" : "Post comment"}
          </button>
        </form>
      </div>
    </div>
  );
}
