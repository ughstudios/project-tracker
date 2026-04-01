"use client";

import { useI18n } from "@/i18n/context";
import { useEffect, useMemo, useState } from "react";

const FILTER_NO_PROJECT = "__none__";

type User = { id: string; name: string; email: string; role: string };
type Project = {
  id: string;
  name: string;
  product: string;
  _count?: { issues: number };
};
type Issue = {
  id: string;
  title: string;
  status: string;
  symptom: string;
  cause: string;
  solution: string;
  rndContact: string;
  project: { id: string; name: string; product: string } | null;
  assignee: { id: string; name: string; email: string } | null;
  reporter: { id: string; name: string };
};

export function IssueDashboard() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [usersRes, issuesRes, projectsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/issues"),
      fetch("/api/projects"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (issuesRes.ok) setIssues(await issuesRes.json());
    if (projectsRes.ok) setProjects(await projectsRes.json());
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await loadData();
    };
    void run();
  }, []);

  const filteredIssues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesText =
        !q ||
        [
          issue.title,
          issue.project?.name ?? "",
          issue.project?.product ?? "",
          issue.symptom,
          issue.cause,
          issue.solution,
          issue.rndContact,
          issue.assignee?.name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesAssignee =
        !assigneeFilter || issue.assignee?.id === assigneeFilter;
      const matchesProject =
        !projectFilter ||
        (projectFilter === FILTER_NO_PROJECT
          ? issue.project === null
          : issue.project?.id === projectFilter);
      const matchesStatus = !statusFilter || issue.status === statusFilter;

      return matchesText && matchesAssignee && matchesProject && matchesStatus;
    });
  }, [issues, query, assigneeFilter, projectFilter, statusFilter]);

  const updateIssue = async (id: string, payload: { status?: string; assigneeId?: string }) => {
    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    loadData();
  };

  const deleteIssue = async (id: string) => {
    if (!confirm(t("dashboard.deleteConfirm"))) return;
    await fetch(`/api/issues/${id}`, { method: "DELETE" });
    loadData();
  };

  const moveIssueToStatus = async (id: string, nextStatus: string) => {
    const issue = issues.find((item) => item.id === id);
    if (!issue || issue.status === nextStatus) return;
    await updateIssue(id, { status: nextStatus });
  };

  const statuses = ["OPEN", "IN_PROGRESS", "DONE"] as const;

  const columnTitle = (status: (typeof statuses)[number]) => {
    const key = `issueStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("dashboard.filters")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            className="input md:col-span-2"
            placeholder={t("dashboard.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">{t("dashboard.allUsers")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">{t("dashboard.allProjects")}</option>
            <option value={FILTER_NO_PROJECT}>{t("dashboard.noProjectFilter")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={() => {
              setQuery("");
              setAssigneeFilter("");
              setProjectFilter("");
              setStatusFilter("");
            }}
          >
            {t("dashboard.clear")}
          </button>
        </div>
      </section>

      <section>
        <div>
          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
              {t("common.loading")}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {statuses
                .filter((status) => !statusFilter || status === statusFilter)
                .map((status) => {
                  const columnIssues = filteredIssues.filter(
                    (issue) => issue.status === status,
                  );
                  return (
                    <section
                      key={status}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/issue-id") || draggingIssueId;
                        if (!id) return;
                        setDraggingIssueId(null);
                        void moveIssueToStatus(id, status);
                      }}
                    >
                      <header className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-700">
                          {columnTitle(status)}
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-500">
                          {columnIssues.length}
                        </span>
                      </header>
                      <div className="space-y-3">
                        {columnIssues.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-xs text-zinc-500">
                            {t("common.noIssues")}
                          </p>
                        ) : (
                          columnIssues.map((issue) => (
                            <article
                              key={issue.id}
                              className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/issue-id", issue.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDraggingIssueId(issue.id);
                              }}
                              onDragEnd={() => {
                                setDraggingIssueId(null);
                              }}
                            >
                              <p className="text-sm font-semibold text-zinc-800">{issue.title}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {issue.project
                                  ? `${issue.project.name} - ${issue.project.product}`
                                  : t("common.noProject")}
                              </p>
                              <p className="mt-2 text-sm text-zinc-700">{issue.symptom}</p>
                              <div className="mt-3 grid grid-cols-1 gap-2">
                                <select
                                  className="input"
                                  value={issue.assignee?.id ?? ""}
                                  onChange={(e) =>
                                    updateIssue(issue.id, { assigneeId: e.target.value })
                                  }
                                >
                                  <option value="">{t("common.unassigned")}</option>
                                  {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="input"
                                  value={issue.status}
                                  onChange={(e) =>
                                    updateIssue(issue.id, { status: e.target.value })
                                  }
                                >
                                  <option value="OPEN">{t("issueStatus.OPEN")}</option>
                                  <option value="IN_PROGRESS">
                                    {t("issueStatus.IN_PROGRESS")}
                                  </option>
                                  <option value="DONE">{t("issueStatus.DONE")}</option>
                                </select>
                              </div>
                              <details className="mt-3 text-xs text-zinc-600">
                                <summary className="cursor-pointer select-none">
                                  {t("common.details")}
                                </summary>
                                <div className="mt-2 space-y-1">
                                  <p>
                                    <strong>{t("dashboard.cause")}</strong> {issue.cause || "-"}
                                  </p>
                                  <p>
                                    <strong>{t("dashboard.solution")}</strong>{" "}
                                    {issue.solution || "-"}
                                  </p>
                                  <p>
                                    <strong>{t("dashboard.rnd")}</strong> {issue.rndContact || "-"}
                                  </p>
                                </div>
                              </details>
                              <button
                                type="button"
                                onClick={() => deleteIssue(issue.id)}
                                className="mt-3 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                              >
                                {t("common.delete")}
                              </button>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
