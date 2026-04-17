"use client";

import { UserMultiSelect } from "@/components/user-multi-select";
import { UploadProgressBar } from "@/components/upload-progress-bar";
import { useI18n } from "@/i18n/context";
import { uploadFilesViaBlobClient } from "@/lib/blob-client-upload";
import { PROJECTS_LIST_VERSION_KEY } from "@/lib/project-list-sync";
import { getLocalizedText } from "@/lib/translated-content";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

type User = { id: string; name: string | null; email: string | null };

type ProjectSummary = {
  id: string;
  name: string;
  product: string;
  customer?: { id: string; name: string };
};

type CustomerSummary = { id: string; name: string };

const FILTER_UNLINKED = "__unlinked__";
const FILTER_ASSIGNEE_UNASSIGNED = "__unassigned__";

type IssueListItem = {
  id: string;
  createdAt: string;
  title: string;
  titleTranslated: string | null;
  status: string;
  symptom: string;
  symptomTranslated: string | null;
  contentLanguage: string | null;
  project: { id: string; name: string; product: string } | null;
  customer: { id: string; name: string } | null;
  assignees: { id: string; name: string | null; email: string | null }[];
};

function matchesLinkFilter(issue: IssueListItem, filter: string) {
  if (!filter) return true;
  if (filter === FILTER_UNLINKED) return !issue.project && !issue.customer;
  if (filter.startsWith("p:")) return issue.project?.id === filter.slice(2);
  if (filter.startsWith("c:")) return issue.customer?.id === filter.slice(2);
  return true;
}

function statusLabel(t: (k: string) => string, status: string) {
  const key = `issueStatus.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

const fetchFresh: RequestInit = { credentials: "include", cache: "no-store" };

function IssuesPageContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerFromQuery = searchParams.get("customer")?.trim() ?? "";
  const projectFromQuery = searchParams.get("project")?.trim() ?? "";
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [issues, setIssues] = useState<IssueListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [linkFilter, setLinkFilter] = useState("");
  const [assigneeListFilter, setAssigneeListFilter] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formSymptom, setFormSymptom] = useState("");
  const [formCause, setFormCause] = useState("");
  const [formSolution, setFormSolution] = useState("");
  const [formRnd, setFormRnd] = useState("");
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]);
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [formAttachmentUploadNote, setFormAttachmentUploadNote] = useState("");
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [createAttachmentProgress, setCreateAttachmentProgress] = useState<number | null>(null);
  const [archivingIssueId, setArchivingIssueId] = useState<string | null>(null);
  const [copiedIssueId, setCopiedIssueId] = useState<string | null>(null);
  const loadLists = useCallback(async () => {
    const [usersRes, issuesRes, projectsRes, customersRes] = await Promise.all([
      fetch("/api/users", fetchFresh),
      fetch("/api/issues", fetchFresh),
      fetch("/api/projects", fetchFresh),
      fetch("/api/customers", fetchFresh),
    ]);
    if (usersRes.ok) setUsers((await usersRes.json()) as User[]);
    if (issuesRes.ok) setIssues((await issuesRes.json()) as IssueListItem[]);
    if (projectsRes.ok) {
      const plist = (await projectsRes.json()) as ProjectSummary[];
      setProjects(plist);
    }
    if (customersRes.ok) setCustomers((await customersRes.json()) as CustomerSummary[]);
    setListLoading(false);
  }, []);

  useEffect(() => {
    if (formFiles.length === 0) setFormAttachmentUploadNote("");
  }, [formFiles.length]);

  useEffect(() => {
    if (pathname !== "/issues") return;
    void (async () => {
      await loadLists();
    })();
  }, [pathname, loadLists]);

  useEffect(() => {
    if (pathname !== "/issues") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROJECTS_LIST_VERSION_KEY) void loadLists();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname, loadLists]);

  useEffect(() => {
    if (pathname !== "/issues") return;
    if (projectFromQuery) {
      setLinkFilter(`p:${projectFromQuery}`);
      return;
    }
    if (customerFromQuery) setLinkFilter(`c:${customerFromQuery}`);
  }, [pathname, projectFromQuery, customerFromQuery]);

  const filteredIssues = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return issues.filter((i) => {
      const matchLink = matchesLinkFilter(i, linkFilter);
      const matchAssignee =
        !assigneeListFilter ||
        (assigneeListFilter === FILTER_ASSIGNEE_UNASSIGNED
          ? i.assignees.length === 0
          : i.assignees.some((a) => a.id === assigneeListFilter));
      const matchText =
        !q ||
        [
          i.id,
          i.title,
          i.titleTranslated ?? "",
          i.symptom,
          i.symptomTranslated ?? "",
          i.project?.name ?? "",
          i.customer?.name ?? "",
          i.assignees.map((a) => `${a.name ?? ""} ${a.email ?? ""}`).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchLink && matchAssignee && matchText;
    });
  }, [issues, listQuery, linkFilter, assigneeListFilter]);

  const createIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSymptom.trim()) return;
    setCreating(true);
    const res = await fetch("/api/issues", {
      method: "POST",
      ...fetchFresh,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle.trim(),
        ...(formProjectId ? { projectId: formProjectId } : {}),
        ...(formCustomerId ? { customerId: formCustomerId } : {}),
        symptom: formSymptom.trim(),
        cause: formCause.trim(),
        solution: formSolution.trim(),
        rndContact: formRnd.trim(),
        assigneeIds: formAssigneeIds,
      }),
    });
    if (!res.ok) {
      setCreating(false);
      alert(t("issues.couldNotCreate"));
      return;
    }
    const created = (await res.json()) as { id: string };

    if (formFiles.length > 0) {
      const note = formAttachmentUploadNote.trim();
      if (!note) {
        alert(t("common.attachmentUploadNoteRequiredAlert"));
        setCreating(false);
        return;
      }
      setCreateAttachmentProgress(0);
      try {
        const up = await uploadFilesViaBlobClient({
          files: formFiles,
          tokenExtras: { scope: "issue", issueId: created.id },
          completeUrl: `/api/issues/${encodeURIComponent(created.id)}/attachments/complete`,
          uploadNote: note,
          onProgress: (p) => setCreateAttachmentProgress(p === null ? -1 : p),
        });
        if (!up.ok) {
          alert(up.error ?? t("issueDetail.couldNotUpload"));
        }
      } finally {
        setCreateAttachmentProgress(null);
      }
    }

    setFormTitle("");
    setFormSymptom("");
    setFormCause("");
    setFormSolution("");
    setFormRnd("");
    setFormAssigneeIds([]);
    setFormFiles([]);
    setFormAttachmentUploadNote("");
    if (createFileInputRef.current) createFileInputRef.current.value = "";
    setCreating(false);
    await loadLists();
    router.push(`/issues/${created.id}`);
  };

  const archiveIssue = async (issueId: string, title: string) => {
    const confirmed = confirm(t("issues.archiveConfirm", { title }));
    if (!confirmed) return;
    setArchivingIssueId(issueId);
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      ...fetchFresh,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setArchivingIssueId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("issues.couldNotArchive"));
      return;
    }
    await loadLists();
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

  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("issues.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("issues.subtitle")}</p>
      </header>

      <section className="panel-surface overflow-hidden rounded-xl p-0">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/[0.08]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("issues.allIssues")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t("issues.listToolbarHint")}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-zinc-600 underline decoration-zinc-400/60 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:decoration-white/25 dark:hover:text-zinc-200">
                  {t("issues.listHelpSummary")}
                </summary>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t("issues.listHelp")}
                </p>
              </details>
            </div>
            <button
              type="button"
              aria-expanded={showCreateForm}
              aria-controls="new-issue-form"
              onClick={() => setShowCreateForm((value) => !value)}
              className="btn-primary inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold"
            >
              + {t("issues.newIssue")}
            </button>
          </div>
        </div>
        {showCreateForm ? (
          <div
            id="new-issue-form"
            className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-white/[0.08] dark:bg-[#12141c]/80"
          >
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#15171e]/95 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <form onSubmit={createIssue} className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">{t("common.title")}</span>
                <input
                  className="input mt-1 w-full"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 md:col-span-2">{t("issues.linkHint")}</p>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{t("issues.projectOptional")}</span>
                <select
                  className="input mt-1 w-full"
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                >
                  <option value="">{t("issues.noProject")}</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.customer
                        ? `${proj.name} (${proj.customer.name}) — ${proj.product}`
                        : `${proj.name} — ${proj.product}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{t("issues.customerOptional")}</span>
                <select
                  className="input mt-1 w-full"
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                >
                  <option value="">{t("issues.noCustomer")}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2">
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {t("common.assignee")}
                </span>
                <div className="mt-1">
                  <UserMultiSelect
                    users={users}
                    selectedIds={formAssigneeIds}
                    onChange={setFormAssigneeIds}
                    disabled={creating}
                  />
                </div>
              </div>
              <label className="block text-sm md:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">{t("common.symptom")}</span>
                <textarea
                  className="input mt-1 min-h-[72px] w-full"
                  value={formSymptom}
                  onChange={(e) => setFormSymptom(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{t("common.cause")}</span>
                <textarea
                  className="input mt-1 min-h-[64px] w-full"
                  value={formCause}
                  onChange={(e) => setFormCause(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{t("common.solution")}</span>
                <textarea
                  className="input mt-1 min-h-[64px] w-full"
                  value={formSolution}
                  onChange={(e) => setFormSolution(e.target.value)}
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">{t("common.rndContact")}</span>
                <input
                  className="input mt-1 w-full"
                  value={formRnd}
                  onChange={(e) => setFormRnd(e.target.value)}
                />
              </label>
              <div className="block text-sm md:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">{t("issues.attachmentsOptional")}</span>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("issues.attachmentsOnCreateHelp")}</p>
                <label className="mt-2 block text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{t("common.attachmentUploadNoteLabel")}</span>
                  <textarea
                    className="input mt-1 min-h-[64px] w-full"
                    value={formAttachmentUploadNote}
                    onChange={(e) => setFormAttachmentUploadNote(e.target.value)}
                    placeholder={t("common.attachmentUploadNotePlaceholder")}
                    disabled={creating}
                    required={formFiles.length > 0}
                  />
                </label>
                <div className="input-file-zone mt-1 max-w-xl">
                  <input
                    ref={createFileInputRef}
                    type="file"
                    multiple
                    disabled={creating}
                    className="input-file"
                    onChange={(e) => setFormFiles(Array.from(e.target.files ?? []))}
                  />
                </div>
                {formFiles.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {formFiles.map((f) => f.name).join(", ")}
                  </p>
                ) : null}
                <UploadProgressBar
                  value={createAttachmentProgress}
                  label={t("issueDetail.uploadingFiles")}
                  className="mt-2 max-w-xl"
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  {creating ? t("common.creating") : t("issues.createIssue")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                  className="btn-secondary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
            </div>
          </div>
        ) : null}

        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/[0.08] dark:bg-[#12141c]/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
            <div className="flex w-full min-w-0 flex-col gap-1.5 lg:w-52 lg:shrink-0">
              <label
                htmlFor="issues-filter-assignee"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("issues.filterByAssignee")}
              </label>
              <select
                id="issues-filter-assignee"
                className="input w-full text-sm"
                value={assigneeListFilter}
                onChange={(e) => setAssigneeListFilter(e.target.value)}
              >
                <option value="">{t("dashboard.allUsers")}</option>
                <option value={FILTER_ASSIGNEE_UNASSIGNED}>{t("dashboard.unassignedOnly")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1.5 lg:w-60 lg:shrink-0">
              <label
                htmlFor="issues-filter-link"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("issues.filterByLink")}
              </label>
              <select
                id="issues-filter-link"
                className="input w-full text-sm"
                value={linkFilter}
                onChange={(e) => setLinkFilter(e.target.value)}
              >
                <option value="">{t("issues.allLinks")}</option>
                <option value={FILTER_UNLINKED}>{t("issues.unlinked")}</option>
                <optgroup label={t("common.customer")}>
                  {customers.map((c) => (
                    <option key={c.id} value={`c:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("common.projects")}>
                  {projects.map((proj) => (
                    <option key={proj.id} value={`p:${proj.id}`}>
                      {proj.customer ? `${proj.name} (${proj.customer.name})` : proj.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label
                htmlFor="issues-search"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {t("common.search")}
              </label>
              <input
                id="issues-search"
                className="input w-full text-sm"
                placeholder={t("issues.searchPlaceholder")}
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          {listLoading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("issues.loading")}</p>
          ) : filteredIssues.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("issues.noMatch")}</p>
          ) : (
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-white/[0.08] dark:border-white/[0.08]">
              {filteredIssues.map((i) => (
                <li
                  key={i.id}
                  className="px-3 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.04] sm:flex sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/issues/${i.id}`}
                      className="link-accent text-base font-semibold underline"
                    >
                      {getLocalizedText({
                        original: i.title,
                        translated: i.titleTranslated,
                        sourceLanguage: i.contentLanguage,
                        locale,
                      }).text}
                    </Link>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {t("issueDetail.opened")}: {new Date(i.createdAt).toLocaleString()}
                    </span>
                    <span className="mt-0.5 block break-all font-mono text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                      {t("issues.ticketId")}:{" "}
                      <span
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer font-mono text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void copyIssueUrl(i.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          e.stopPropagation();
                          void copyIssueUrl(i.id);
                        }}
                        title={t("issues.copyIssueLink")}
                      >
                        {i.id}
                      </span>
                      {copiedIssueId === i.id ? (
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">{t("common.copied")}</span>
                      ) : null}
                    </span>
                    {getLocalizedText({
                      original: i.title,
                      translated: i.titleTranslated,
                      sourceLanguage: i.contentLanguage,
                      locale,
                    }).usedTranslation ? (
                      <span className="mt-0.5 block text-xs text-sky-800 dark:text-sky-400/90">
                        {t("common.autoTranslatedFrom", {
                          language: t(
                            `language.${getLocalizedText({
                              original: i.title,
                              translated: i.titleTranslated,
                              sourceLanguage: i.contentLanguage,
                              locale,
                            }).sourceLanguage ?? "en"}`,
                          ),
                        })}
                      </span>
                    ) : null}
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
                      {(() => {
                        const linkPart =
                          [
                            i.project?.name,
                            i.customer
                              ? `${t("common.customer")}: ${i.customer.name}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || t("issues.unlinked");
                        return `${linkPart} · ${statusLabel(t, i.status)}`;
                      })()}
                      {i.assignees.length > 0
                        ? ` · ${i.assignees.map((a) => a.name ?? a.email).join(", ")}`
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary mt-2 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium sm:mt-0"
                    onClick={() => archiveIssue(i.id, i.title)}
                    disabled={archivingIssueId === i.id}
                  >
                    {archivingIssueId === i.id ? t("common.archiving") : t("common.archive")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense
      fallback={
        <div className="panel-surface rounded-xl p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        </div>
      }
    >
      <IssuesPageContent />
    </Suspense>
  );
}
