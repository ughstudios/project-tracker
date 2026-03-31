"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type User = { id: string; name: string | null; email: string | null };

type ProjectSummary = {
  id: string;
  name: string;
  product: string;
};

type IssueListItem = {
  id: string;
  title: string;
  status: string;
  symptom: string;
  project: { id: string; name: string; product: string };
  assignee: { id: string; name: string | null; email: string | null } | null;
};

export default function IssuesPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [issues, setIssues] = useState<IssueListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [projectFilter, setProjectFilter] = useState("");
  const [listQuery, setListQuery] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSymptom, setFormSymptom] = useState("");
  const [formCause, setFormCause] = useState("");
  const [formSolution, setFormSolution] = useState("");
  const [formRnd, setFormRnd] = useState("");
  const [formAssigneeId, setFormAssigneeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [archivingIssueId, setArchivingIssueId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadLists = useCallback(async () => {
    const [usersRes, issuesRes, projectsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/issues"),
      fetch("/api/projects"),
    ]);
    if (usersRes.ok) setUsers((await usersRes.json()) as User[]);
    if (issuesRes.ok) setIssues((await issuesRes.json()) as IssueListItem[]);
    if (projectsRes.ok) {
      const plist = (await projectsRes.json()) as ProjectSummary[];
      setProjects(plist);
      setFormProjectId((prev) => prev || (plist[0]?.id ?? ""));
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadLists();
      const sessionRes = await fetch("/api/auth/session");
      if (sessionRes.ok) {
        const session = (await sessionRes.json()) as { user?: { role?: string } };
        setIsAdmin(session.user?.role === "ADMIN");
      }
    })();
  }, [loadLists]);

  const filteredIssues = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return issues.filter((i) => {
      const matchProj = !projectFilter || i.project.id === projectFilter;
      const matchText =
        !q ||
        [i.title, i.symptom, i.project.name, i.assignee?.name ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchProj && matchText;
    });
  }, [issues, listQuery, projectFilter]);

  const createIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSymptom.trim() || !formProjectId) return;
    setCreating(true);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle.trim(),
        projectId: formProjectId,
        symptom: formSymptom.trim(),
        cause: formCause.trim(),
        solution: formSolution.trim(),
        rndContact: formRnd.trim(),
        assigneeId: formAssigneeId || null,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      alert("Could not create issue.");
      return;
    }
    const created = (await res.json()) as { id: string };
    setFormTitle("");
    setFormSymptom("");
    setFormCause("");
    setFormSolution("");
    setFormRnd("");
    setFormAssigneeId("");
    await loadLists();
    router.push(`/issues/${created.id}`);
  };

  const archiveIssue = async (issueId: string, title: string) => {
    const confirmed = confirm(`Archive issue "${title}"?`);
    if (!confirmed) return;
    setArchivingIssueId(issueId);
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setArchivingIssueId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "Could not archive issue.");
      return;
    }
    await loadLists();
  };

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Issues</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Create an issue, then open it to edit details and use the thread for updates.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">New issue</h2>
        <form onSubmit={createIssue} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">Title</span>
            <input
              className="input mt-1 w-full"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Project</span>
            <select
              className="input mt-1 w-full"
              value={formProjectId}
              onChange={(e) => setFormProjectId(e.target.value)}
              required
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} — {proj.product}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Assignee</span>
            <select
              className="input mt-1 w-full"
              value={formAssigneeId}
              onChange={(e) => setFormAssigneeId(e.target.value)}
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
              value={formSymptom}
              onChange={(e) => setFormSymptom(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Cause</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={formCause}
              onChange={(e) => setFormCause(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Solution</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={formSolution}
              onChange={(e) => setFormSolution(e.target.value)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">R&amp;D contact</span>
            <input
              className="input mt-1 w-full"
              value={formRnd}
              onChange={(e) => setFormRnd(e.target.value)}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
            >
              {creating ? "Creating…" : "Create issue"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">All issues</h2>
        <p className="mt-1 text-sm text-zinc-600">Click an issue to open its page (edit + thread).</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className="input w-full"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
          <input
            className="input w-full"
            placeholder="Search title, symptom…"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 space-y-2">
          {listLoading ? (
            <p className="text-sm text-zinc-600">Loading…</p>
          ) : filteredIssues.length === 0 ? (
            <p className="text-sm text-zinc-500">No issues match.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              {filteredIssues.map((i) => (
                <li key={i.id} className="px-3 py-3 hover:bg-zinc-50 sm:flex sm:items-center sm:justify-between">
                  <Link href={`/issues/${i.id}`} className="block min-w-0">
                    <span className="font-medium text-zinc-900">{i.title}</span>
                    <span className="block text-xs text-zinc-500 sm:text-sm">
                      {i.project.name} · {i.status}
                      {i.assignee ? ` · ${i.assignee.name ?? i.assignee.email}` : ""}
                    </span>
                  </Link>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 sm:mt-0"
                      onClick={() => archiveIssue(i.id, i.title)}
                      disabled={archivingIssueId === i.id}
                    >
                      {archivingIssueId === i.id ? "Archiving..." : "Archive"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
