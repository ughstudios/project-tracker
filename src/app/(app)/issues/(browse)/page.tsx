"use client";

import { UploadProgressBar } from "@/components/upload-progress-bar";
import { useI18n } from "@/i18n/context";
import { uploadFilesViaBlobClient } from "@/lib/blob-client-upload";
import { PROJECTS_LIST_VERSION_KEY } from "@/lib/project-list-sync";
import { getLocalizedText } from "@/lib/translated-content";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  assignee: { id: string; name: string | null; email: string | null } | null;
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

export default function IssuesPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
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
  const [formAssigneeId, setFormAssigneeId] = useState("");
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

  const filteredIssues = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return issues.filter((i) => {
      const matchLink = matchesLinkFilter(i, linkFilter);
      const matchAssignee =
        !assigneeListFilter ||
        (assigneeListFilter === FILTER_ASSIGNEE_UNASSIGNED
          ? !i.assignee
          : i.assignee?.id === assigneeListFilter);
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
          i.assignee?.name ?? "",
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
        assigneeId: formAssigneeId || null,
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
    setFormAssigneeId("");
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
      <header className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("issues.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("issues.subtitle")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("issues.allIssues")}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("issues.listHelp")}</p>
          </div>
          <button
            type="button"
            aria-expanded={showCreateForm}
            aria-controls="new-issue-form"
            onClick={() => setShowCreateForm((value) => !value)}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
          >
            + {t("issues.newIssue")}
          </button>
        </div>
        {showCreateForm ? (
          <div id="new-issue-form" className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-4">
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
              <label className="block text-sm md:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">{t("common.assignee")}</span>
                <select
                  className="input mt-1 w-full"
                  value={formAssigneeId}
                  onChange={(e) => setFormAssigneeId(e.target.value)}
                >
                  <option value="">{t("common.unassigned")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
                </select>
              </label>
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
              <label className="block text-sm md:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">{t("issues.attachmentsOptional")}</span>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("issues.attachmentsOnCreateHelp")}</p>
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
                  <>
                    <label className="mt-2 block text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">{t("common.attachmentUploadNoteLabel")}</span>
                      <textarea
                        className="input mt-1 min-h-[64px] w-full"
                        value={formAttachmentUploadNote}
                        onChange={(e) => setFormAttachmentUploadNote(e.target.value)}
                        placeholder={t("common.attachmentUploadNotePlaceholder")}
                        disabled={creating}
                        required
                      />
                    </label>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {formFiles.map((f) => f.name).join(", ")}
                    </p>
                  </>
                ) : null}
                <UploadProgressBar
                  value={createAttachmentProgress}
                  label={t("issueDetail.uploadingFiles")}
                  className="mt-2 max-w-xl"
                />
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:bg-zinc-50 dark:bg-zinc-9500"
                >
                  {creating ? t("common.creating") : t("issues.createIssue")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <select
            className="input w-full"
            value={assigneeListFilter}
            onChange={(e) => setAssigneeListFilter(e.target.value)}
            aria-label={t("issues.filterByAssignee")}
          >
            <option value="">{t("dashboard.allUsers")}</option>
            <option value={FILTER_ASSIGNEE_UNASSIGNED}>{t("dashboard.unassignedOnly")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
          <select
            className="input w-full"
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value)}
            aria-label={t("issues.filterByLink")}
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
          <input
            className="input w-full sm:col-span-2 lg:col-span-1"
            placeholder={t("issues.searchPlaceholder")}
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 space-y-2">
          {listLoading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("issues.loading")}</p>
          ) : filteredIssues.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("issues.noMatch")}</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-700">
              {filteredIssues.map((i) => (
                <li
                  key={i.id}
                  className="px-3 py-3 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800 sm:flex sm:items-center sm:justify-between"
                >
                  <Link href={`/issues/${i.id}`} className="block min-w-0">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {getLocalizedText({
                        original: i.title,
                        translated: i.titleTranslated,
                        sourceLanguage: i.contentLanguage,
                        locale,
                      }).text}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {t("issueDetail.opened")}: {new Date(i.createdAt).toLocaleString()}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 break-all">
                      {t("issues.ticketId")}:{" "}
                      <span
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-300"
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
                        <span className="ml-2 text-emerald-600">{t("common.copied")}</span>
                      ) : null}
                    </span>
                    {getLocalizedText({
                      original: i.title,
                      translated: i.titleTranslated,
                      sourceLanguage: i.contentLanguage,
                      locale,
                    }).usedTranslation ? (
                      <span className="mt-0.5 block text-xs text-blue-700">
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
                      {i.assignee ? ` · ${i.assignee.name ?? i.assignee.email}` : ""}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="mt-2 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 sm:mt-0"
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
