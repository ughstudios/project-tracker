"use client";

import { useI18n } from "@/i18n/context";
import { getLocalizedText } from "@/lib/translated-content";
import type { IssueBoardIssue } from "@/hooks/use-issue-board-data";
import { useIssueBoardData } from "@/hooks/use-issue-board-data";
import Link from "next/link";
import { useMemo, useState } from "react";

const FILTER_UNLINKED = "__unlinked__";
const FILTER_ASSIGNEE_UNASSIGNED = "__unassigned__";

function matchesLinkFilter(issue: IssueBoardIssue, filter: string) {
  if (!filter) return true;
  if (filter === FILTER_UNLINKED) return !issue.project && !issue.customer;
  if (filter.startsWith("p:")) return issue.project?.id === filter.slice(2);
  if (filter.startsWith("c:")) return issue.customer?.id === filter.slice(2);
  return true;
}

export function IssueKanban() {
  const { t, locale } = useI18n();
  const { users, projects, customers, issues, loading, loadData } = useIssueBoardData(["/kanban"]);

  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);
  const [archivingIssueId, setArchivingIssueId] = useState<string | null>(null);
  const [copiedIssueId, setCopiedIssueId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesText =
        !q ||
        [
          issue.id,
          issue.title,
          issue.titleTranslated ?? "",
          issue.project?.name ?? "",
          issue.project?.product ?? "",
          issue.customer?.name ?? "",
          issue.symptom,
          issue.symptomTranslated ?? "",
          issue.cause,
          issue.causeTranslated ?? "",
          issue.solution,
          issue.solutionTranslated ?? "",
          issue.rndContact,
          issue.assignee?.name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesAssignee =
        !assigneeFilter ||
        (assigneeFilter === FILTER_ASSIGNEE_UNASSIGNED
          ? !issue.assignee
          : issue.assignee?.id === assigneeFilter);
      const matchesLink = matchesLinkFilter(issue, linkFilter);
      const matchesStatus = !statusFilter || issue.status === statusFilter;

      return matchesText && matchesAssignee && matchesLink && matchesStatus;
    });
  }, [issues, query, assigneeFilter, linkFilter, statusFilter]);

  const updateIssue = async (id: string, payload: { status?: string; assigneeId?: string }) => {
    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    loadData();
  };

  const archiveIssue = async (id: string, title: string) => {
    if (!confirm(t("issues.archiveConfirm", { title }))) return;
    setArchivingIssueId(id);
    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setArchivingIssueId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("issues.couldNotArchive"));
      return;
    }
    loadData();
  };

  const moveIssueToStatus = async (id: string, nextStatus: string) => {
    const issue = issues.find((item) => item.id === id);
    if (!issue || issue.status === nextStatus) return;
    await updateIssue(id, { status: nextStatus });
  };

  const copyIssueUrl = async (issueId: string) => {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) return;
    const issueUrl = `${window.location.origin}/issues/${encodeURIComponent(issueId)}`;
    try {
      await navigator.clipboard.writeText(issueUrl);
      setCopiedIssueId(issueId);
      window.setTimeout(() => setCopiedIssueId((current) => (current === issueId ? null : current)), 1500);
    } catch {
      alert(t("common.copyFailed"));
    }
  };

  const statuses = ["OPEN", "IN_PROGRESS", "DONE"] as const;

  const columnTitle = (status: (typeof statuses)[number]) => {
    const key = `issueStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  return (
    <div className="space-y-5">
      <section className="panel-surface rounded-xl p-4">
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
            aria-label={t("issues.filterByAssignee")}
          >
            <option value="">{t("dashboard.allUsers")}</option>
            <option value={FILTER_ASSIGNEE_UNASSIGNED}>{t("dashboard.unassignedOnly")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value)}
            aria-label={t("dashboard.filterByLink")}
          >
            <option value="">{t("dashboard.allLinks")}</option>
            <option value={FILTER_UNLINKED}>{t("dashboard.unlinked")}</option>
            <optgroup label={t("common.customer")}>
              {customers.map((c) => (
                <option key={c.id} value={`c:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("common.projects")}>
              {projects.map((project) => (
                <option key={project.id} value={`p:${project.id}`}>
                  {project.customer
                    ? `${project.name} (${project.customer.name})`
                    : project.name}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            onClick={() => {
              setQuery("");
              setAssigneeFilter("");
              setLinkFilter("");
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
            <div className="panel-surface rounded-xl p-4 text-sm text-zinc-600 dark:text-zinc-400">
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
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/[0.06] dark:bg-[#12141c] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
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
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                          {columnTitle(status)}
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                          {columnIssues.length}
                        </span>
                      </header>
                      <div className="space-y-3">
                        {columnIssues.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-500">
                            {t("common.noIssues")}
                          </p>
                        ) : (
                          columnIssues.map((issue) => (
                            <article
                              key={issue.id}
                              className="panel-surface rounded-lg p-3"
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
                              {(() => {
                                const localizedTitle = getLocalizedText({
                                  original: issue.title,
                                  translated: issue.titleTranslated,
                                  sourceLanguage: issue.contentLanguage,
                                  locale,
                                });
                                const localizedSymptom = getLocalizedText({
                                  original: issue.symptom,
                                  translated: issue.symptomTranslated,
                                  sourceLanguage: issue.contentLanguage,
                                  locale,
                                });
                                const localizedCause = getLocalizedText({
                                  original: issue.cause,
                                  translated: issue.causeTranslated,
                                  sourceLanguage: issue.contentLanguage,
                                  locale,
                                });
                                const localizedSolution = getLocalizedText({
                                  original: issue.solution,
                                  translated: issue.solutionTranslated,
                                  sourceLanguage: issue.contentLanguage,
                                  locale,
                                });
                                return (
                                  <>
                              <Link
                                href={`/issues/${issue.id}`}
                                className="link-accent text-sm font-semibold underline"
                              >
                                {localizedTitle.text}
                              </Link>
                              {localizedTitle.usedTranslation ? (
                                <p className="mt-1 text-xs text-sky-800 dark:text-sky-400/90">
                                  {t("common.autoTranslatedFrom", {
                                    language: t(`language.${localizedTitle.sourceLanguage ?? "en"}`),
                                  })}
                                </p>
                              ) : null}
                              <p className="mt-1 font-mono text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 break-all">
                                {t("issueDetail.opened")}: {new Date(issue.createdAt).toLocaleString()}
                              </p>
                              <p className="mt-1 font-mono text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 break-all">
                                {t("issues.ticketId")}:{" "}
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="cursor-pointer underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-300"
                                  onClick={() => {
                                    void copyIssueUrl(issue.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter" && e.key !== " ") return;
                                    e.preventDefault();
                                    void copyIssueUrl(issue.id);
                                  }}
                                  title={t("issues.copyIssueLink")}
                                >
                                  {issue.id}
                                </span>
                                {copiedIssueId === issue.id ? (
                                  <span className="ml-2 text-emerald-600 dark:text-emerald-400">{t("common.copied")}</span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {[
                                  issue.project
                                    ? `${issue.project.name} - ${issue.project.product}`
                                    : null,
                                  issue.customer
                                    ? `${t("common.customer")}: ${issue.customer.name}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || t("dashboard.unlinked")}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                                {localizedSymptom.text}
                              </p>
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
                              <details className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                                <summary className="cursor-pointer select-none">
                                  {t("common.details")}
                                </summary>
                                <div className="mt-2 space-y-1">
                                  <p>
                                    <strong>{t("dashboard.cause")}</strong> {localizedCause.text || "-"}
                                  </p>
                                  <p>
                                    <strong>{t("dashboard.solution")}</strong>{" "}
                                    {localizedSolution.text || "-"}
                                  </p>
                                  <p>
                                    <strong>{t("dashboard.rnd")}</strong> {issue.rndContact || "-"}
                                  </p>
                                </div>
                              </details>
                              <button
                                type="button"
                                onClick={() => archiveIssue(issue.id, issue.title)}
                                disabled={archivingIssueId === issue.id}
                                className="mt-3 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                              >
                                {archivingIssueId === issue.id
                                  ? t("common.archiving")
                                  : t("common.archive")}
                              </button>
                                  </>
                                );
                              })()}
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
