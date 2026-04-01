"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type User = { id: string; name: string | null; email: string | null };

type ProjectSummary = {
  id: string;
  name: string;
  product: string;
};

type ThreadEntry = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string | null };
};

type IssueDetail = {
  id: string;
  title: string;
  status: string;
  symptom: string;
  cause: string;
  solution: string;
  rndContact: string;
  createdAt: string;
  projectId: string | null;
  project: ProjectSummary | null;
  assignee: { id: string; name: string | null; email: string | null } | null;
  reporter: { id: string; name: string | null };
  threadEntries: ThreadEntry[];
};

const fetchInit: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

export function IssueDetailClient({ issueId }: { issueId: string }) {
  const router = useRouter();

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [symptom, setSymptom] = useState("");
  const [cause, setCause] = useState("");
  const [solution, setSolution] = useState("");
  const [rndContact, setRndContact] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const [threadInput, setThreadInput] = useState("");
  const [postingThread, setPostingThread] = useState(false);

  const syncDraftFromIssue = useCallback((data: IssueDetail) => {
    setTitle(data.title);
    setSymptom(data.symptom);
    setCause(data.cause);
    setSolution(data.solution);
    setRndContact(data.rndContact);
    setProjectId(data.projectId ?? "");
    setStatus(data.status);
    setAssigneeId(data.assignee?.id ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setLoadError(null);
      setIssue(null);
      try {
        const [issueRes, usersRes, projectsRes] = await Promise.all([
          fetch(`/api/issues/${encodeURIComponent(issueId)}`, fetchInit),
          fetch("/api/users", fetchInit),
          fetch("/api/projects", fetchInit),
        ]);
        if (cancelled) return;
        if (usersRes.ok) setUsers((await usersRes.json()) as User[]);
        if (projectsRes.ok) setProjects((await projectsRes.json()) as ProjectSummary[]);
        if (!issueRes.ok) {
          setIssue(null);
          if (issueRes.status === 404) {
            setLoadError("Issue not found.");
          } else if (issueRes.status === 401) {
            setLoadError("Session expired or not signed in. Try refreshing the page.");
          } else {
            const errBody = (await issueRes.json().catch(() => null)) as { error?: string } | null;
            setLoadError(errBody?.error ?? `Could not load issue (${issueRes.status}).`);
          }
          return;
        }
        const data = (await issueRes.json()) as IssueDetail;
        if (cancelled) return;
        if (data.id !== issueId) {
          setLoadError("Issue response did not match this page.");
          return;
        }
        setIssue(data);
        syncDraftFromIssue(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issueId, syncDraftFromIssue]);

  const refreshIssue = async () => {
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, fetchInit);
    if (!res.ok) return;
    const data = (await res.json()) as IssueDetail;
    if (data.id !== issueId) return;
    setIssue(data);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !symptom.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, {
      ...fetchInit,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        symptom: symptom.trim(),
        cause: cause.trim(),
        solution: solution.trim(),
        rndContact: rndContact.trim(),
        projectId: projectId || null,
        status,
        assigneeId: assigneeId || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Could not save changes.");
      return;
    }
    const data = (await res.json()) as IssueDetail;
    setIssue(data);
    syncDraftFromIssue(data);
  };

  const postThread = async () => {
    const content = threadInput.trim();
    if (!content) return;
    setPostingThread(true);
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}/thread`, {
      ...fetchInit,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setPostingThread(false);
    if (!res.ok) {
      alert("Could not post.");
      return;
    }
    setThreadInput("");
    await refreshIssue();
  };

  const remove = async () => {
    if (!issue || !confirm(`Delete issue "${issue.title}"?`)) return;
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, { ...fetchInit, method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete.");
      return;
    }
    router.push("/issues");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Loading issue…</p>
      </div>
    );
  }

  if (loadError || !issue) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-800">{loadError ?? "Issue not found."}</p>
          <Link href="/issues" className="mt-3 inline-block text-sm font-medium text-zinc-900 underline">
            Back to issues
          </Link>
        </div>
      </div>
    );
  }

  const p = issue.project;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/issues" className="text-sm font-medium text-zinc-700 underline underline-offset-2">
          ← Issues
        </Link>
        <button
          type="button"
          onClick={remove}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
        >
          Delete issue
        </button>
      </div>

      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Edit issue</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {p ? (
            <>
              Project:{" "}
              <Link
                href={`/projects/${p.id}`}
                className="font-medium text-zinc-900 underline underline-offset-2"
              >
                {p.name}
              </Link>{" "}
              · {p.product}
            </>
          ) : (
            <span className="text-zinc-700">No project linked.</span>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Reporter: {issue.reporter.name ?? "—"} · Opened {new Date(issue.createdAt).toLocaleString()}
        </p>
      </header>

      <form
        onSubmit={save}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold">Details</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">Title</span>
            <input className="input mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Project (optional)</span>
            <select
              className="input mt-1 w-full"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} — {proj.product}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Status</span>
            <select className="input mt-1 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">Assignee</span>
            <select
              className="input mt-1 w-full"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">Symptom</span>
            <textarea
              className="input mt-1 min-h-[72px] w-full"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Cause</span>
            <textarea className="input mt-1 min-h-[64px] w-full" value={cause} onChange={(e) => setCause(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Solution</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">R&amp;D contact</span>
            <input
              className="input mt-1 w-full"
              value={rndContact}
              onChange={(e) => setRndContact(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Thread</h2>
        <p className="mt-1 text-sm text-zinc-600">Anyone logged in can add updates below.</p>
        <div className="mt-3 flex gap-2">
          <textarea
            className="input min-h-[80px] flex-1"
            placeholder="Add an update to this issue…"
            value={threadInput}
            onChange={(e) => setThreadInput(e.target.value)}
          />
          <button
            type="button"
            className="self-end rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
            onClick={postThread}
            disabled={postingThread}
          >
            {postingThread ? "Posting…" : "Post"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {issue.threadEntries.length === 0 ? (
            <p className="text-sm text-zinc-500">No replies yet.</p>
          ) : (
            issue.threadEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="whitespace-pre-wrap text-sm text-zinc-800">{entry.content}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {entry.author.name ?? entry.author.email ?? "Unknown"}
                  {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString()}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
