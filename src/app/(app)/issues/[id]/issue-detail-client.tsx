"use client";

import { UploadProgressBar } from "@/components/upload-progress-bar";
import { useI18n } from "@/i18n/context";
import { uploadFilesViaBlobClient, validateFilesBeforeMultipartUpload } from "@/lib/blob-client-upload";
import { useDirectBlobUpload } from "@/lib/hooks/use-direct-blob-upload";
import { isPrivilegedAdmin } from "@/lib/roles";
import { postFormDataWithProgress } from "@/lib/upload-with-progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type User = { id: string; name: string | null; email: string | null };

type ProjectSummary = {
  id: string;
  name: string;
  product: string;
};

type CustomerSummary = { id: string; name: string };

type IssueFileAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploader: { id: string; name: string | null; email: string | null } | null;
};

type ThreadEntry = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string | null };
  attachments: IssueFileAttachment[];
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
  customerId: string | null;
  project: ProjectSummary | null;
  customer: { id: string; name: string } | null;
  assignee: { id: string; name: string | null; email: string | null } | null;
  reporter: { id: string; name: string | null };
  attachments: IssueFileAttachment[];
};

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
const VIDEO_EXT = new Set(["mp4", "webm", "ogv", "mov", "m4v"]);

function isImageExt(ext: string) {
  return IMAGE_EXT.has(ext.toLowerCase());
}

function isVideoExt(ext: string) {
  return VIDEO_EXT.has(ext.toLowerCase());
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function withAttachmentDefaults(data: IssueDetail): IssueDetail {
  return {
    ...data,
    attachments: data.attachments ?? [],
  };
}

const THREAD_PAGE_SIZE = 10;

const fetchInit: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

export function IssueDetailClient({ issueId }: { issueId: string }) {
  const router = useRouter();
  const { t } = useI18n();

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [symptom, setSymptom] = useState("");
  const [cause, setCause] = useState("");
  const [solution, setSolution] = useState("");
  const [rndContact, setRndContact] = useState("");
  const [projectId, setProjectId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const [threadInput, setThreadInput] = useState("");
  const [threadFiles, setThreadFiles] = useState<File[]>([]);
  const threadFileInputRef = useRef<HTMLInputElement>(null);
  const [postingThread, setPostingThread] = useState(false);
  const [uploadingIssueFiles, setUploadingIssueFiles] = useState(false);
  const [issueUploadProgress, setIssueUploadProgress] = useState<number | null>(null);
  const [threadUploadProgress, setThreadUploadProgress] = useState<number | null>(null);
  const issueFileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [threadEntries, setThreadEntries] = useState<ThreadEntry[]>([]);
  const [threadPage, setThreadPage] = useState(1);
  const [threadTotal, setThreadTotal] = useState(0);
  const [threadListLoading, setThreadListLoading] = useState(false);
  const blobDirect = useDirectBlobUpload();

  const loadThreadPage = useCallback(
    async (page: number | "last") => {
      setThreadListLoading(true);
      try {
        const q = page === "last" ? "page=last" : `page=${page}`;
        const res = await fetch(
          `/api/issues/${encodeURIComponent(issueId)}/thread?${q}&pageSize=${THREAD_PAGE_SIZE}`,
          fetchInit,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          entries: ThreadEntry[];
          total: number;
          page: number;
          totalPages: number;
        };
        setThreadEntries(
          data.entries.map((e) => ({
            ...e,
            attachments: e.attachments ?? [],
          })),
        );
        setThreadPage(data.page);
        setThreadTotal(data.total);
      } finally {
        setThreadListLoading(false);
      }
    },
    [issueId],
  );

  const syncDraftFromIssue = useCallback((data: IssueDetail) => {
    setTitle(data.title);
    setSymptom(data.symptom);
    setCause(data.cause);
    setSolution(data.solution);
    setRndContact(data.rndContact);
    setProjectId(data.projectId ?? "");
    setCustomerId(data.customerId ?? "");
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
      setThreadEntries([]);
      setThreadPage(1);
      setThreadTotal(0);
      try {
        const [issueRes, threadRes, usersRes, projectsRes, customersRes, sessionRes] =
          await Promise.all([
            fetch(`/api/issues/${encodeURIComponent(issueId)}`, fetchInit),
            fetch(
              `/api/issues/${encodeURIComponent(issueId)}/thread?page=1&pageSize=${THREAD_PAGE_SIZE}`,
              fetchInit,
            ),
            fetch("/api/users", fetchInit),
            fetch("/api/projects", fetchInit),
            fetch("/api/customers", fetchInit),
            fetch("/api/auth/session", fetchInit),
          ]);
        if (cancelled) return;
        if (sessionRes.ok) {
          const session = (await sessionRes.json()) as { user?: { role?: string } };
          setIsAdmin(isPrivilegedAdmin(session.user?.role));
        }
        if (usersRes.ok) setUsers((await usersRes.json()) as User[]);
        if (projectsRes.ok) setProjects((await projectsRes.json()) as ProjectSummary[]);
        if (customersRes.ok) setCustomers((await customersRes.json()) as CustomerSummary[]);
        if (!issueRes.ok) {
          setIssue(null);
          if (issueRes.status === 404) {
            setLoadError(t("issueDetail.notFound"));
          } else if (issueRes.status === 401) {
            setLoadError(t("issueDetail.sessionExpired"));
          } else {
            const errBody = (await issueRes.json().catch(() => null)) as { error?: string } | null;
            setLoadError(
              errBody?.error ?? t("issueDetail.loadFailed", { status: String(issueRes.status) }),
            );
          }
          return;
        }
        const data = withAttachmentDefaults((await issueRes.json()) as IssueDetail);
        if (cancelled) return;
        if (data.id !== issueId) {
          setLoadError(t("issueDetail.mismatch"));
          return;
        }
        setIssue(data);
        syncDraftFromIssue(data);
        if (threadRes.ok) {
          const td = (await threadRes.json()) as {
            entries: ThreadEntry[];
            total: number;
            page: number;
          };
          if (!cancelled) {
            setThreadEntries(
              td.entries.map((e) => ({
                ...e,
                attachments: e.attachments ?? [],
              })),
            );
            setThreadPage(td.page);
            setThreadTotal(td.total);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issueId, syncDraftFromIssue, t]);

  const refreshIssue = async () => {
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, fetchInit);
    if (!res.ok) return;
    const data = withAttachmentDefaults((await res.json()) as IssueDetail);
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
        customerId: customerId || null,
        status,
        assigneeId: assigneeId || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert(t("issueDetail.couldNotSave"));
      return;
    }
    const data = withAttachmentDefaults((await res.json()) as IssueDetail);
    setIssue(data);
    syncDraftFromIssue(data);
  };

  const uploadIssueAttachments = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadingIssueFiles(true);
    setIssueUploadProgress(0);
    try {
      if (blobDirect) {
        const up = await uploadFilesViaBlobClient({
          files,
          tokenExtras: { scope: "issue", issueId },
          completeUrl: `/api/issues/${encodeURIComponent(issueId)}/attachments/complete`,
          onProgress: (p) => setIssueUploadProgress(p === null ? -1 : p),
        });
        if (issueFileInputRef.current) issueFileInputRef.current.value = "";
        if (!up.ok) {
          alert(up.error ?? t("issueDetail.couldNotUpload"));
          return;
        }
      } else {
        const pre = validateFilesBeforeMultipartUpload(files);
        if (pre) {
          alert(pre);
          return;
        }
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const res = await postFormDataWithProgress(
          `/api/issues/${encodeURIComponent(issueId)}/attachments`,
          fd,
          (p) => setIssueUploadProgress(p === null ? -1 : p),
        );
        if (issueFileInputRef.current) issueFileInputRef.current.value = "";
        if (!res.ok) {
          const data = await res.json<{ error?: string }>();
          alert(data.error ?? t("issueDetail.couldNotUpload"));
          return;
        }
      }
      await refreshIssue();
    } finally {
      setUploadingIssueFiles(false);
      setIssueUploadProgress(null);
    }
  };

  const deleteIssueAttachment = async (attachmentId: string) => {
    if (!confirm(t("issueDetail.confirmRemoveAttachment"))) return;
    const res = await fetch(
      `/api/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { ...fetchInit, method: "DELETE" },
    );
    if (!res.ok) {
      alert(t("issueDetail.couldNotUpload"));
      return;
    }
    await refreshIssue();
  };

  const deleteThreadAttachment = async (entryId: string, attachmentId: string) => {
    if (!confirm(t("issueDetail.confirmRemoveAttachment"))) return;
    const res = await fetch(
      `/api/issues/${encodeURIComponent(issueId)}/thread/${encodeURIComponent(entryId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { ...fetchInit, method: "DELETE" },
    );
    if (!res.ok) {
      alert(t("issueDetail.couldNotUpload"));
      return;
    }
    await loadThreadPage(threadPage);
  };

  const postThread = async () => {
    const content = threadInput.trim();
    if (!content && threadFiles.length === 0) return;
    setPostingThread(true);
    try {
      if (threadFiles.length > 0 && blobDirect) {
        const createRes = await fetch(`/api/issues/${encodeURIComponent(issueId)}/thread`, {
          ...fetchInit,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, clientBlobAttachments: true }),
        });
        if (!createRes.ok) {
          const data = (await createRes.json().catch(() => ({}))) as { error?: string };
          alert(data.error ?? t("issueDetail.couldNotPost"));
          return;
        }
        const entry = (await createRes.json()) as ThreadEntry;
        setThreadUploadProgress(0);
        try {
          const up = await uploadFilesViaBlobClient({
            files: threadFiles,
            tokenExtras: { scope: "thread", issueId, threadEntryId: entry.id },
            completeUrl: `/api/issues/${encodeURIComponent(issueId)}/thread/${encodeURIComponent(entry.id)}/attachments/complete`,
            onProgress: (p) => setThreadUploadProgress(p === null ? -1 : p),
          });
          if (!up.ok) {
            alert(up.error ?? t("issueDetail.couldNotPost"));
            return;
          }
        } finally {
          setThreadUploadProgress(null);
        }
      } else if (threadFiles.length > 0) {
        const pre = validateFilesBeforeMultipartUpload(threadFiles);
        if (pre) {
          alert(pre);
          return;
        }
        const fd = new FormData();
        fd.set("content", content);
        for (const f of threadFiles) fd.append("files", f);
        setThreadUploadProgress(0);
        try {
          const res = await postFormDataWithProgress(
            `/api/issues/${encodeURIComponent(issueId)}/thread`,
            fd,
            (p) => setThreadUploadProgress(p === null ? -1 : p),
          );
          if (!res.ok) {
            const data = await res.json<{ error?: string }>();
            alert(data.error ?? t("issueDetail.couldNotPost"));
            return;
          }
        } finally {
          setThreadUploadProgress(null);
        }
      } else {
        const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}/thread`, {
          ...fetchInit,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          alert(data.error ?? t("issueDetail.couldNotPost"));
          return;
        }
      }
      setThreadInput("");
      setThreadFiles([]);
      if (threadFileInputRef.current) threadFileInputRef.current.value = "";
      await loadThreadPage("last");
    } finally {
      setPostingThread(false);
    }
  };

  const removeThreadFile = (index: number) => {
    setThreadFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0 && threadFileInputRef.current) {
        threadFileInputRef.current.value = "";
      }
      return next;
    });
  };

  const clearThreadFiles = () => {
    setThreadFiles([]);
    if (threadFileInputRef.current) threadFileInputRef.current.value = "";
  };

  const archive = async () => {
    if (!issue || !confirm(t("issues.archiveConfirm", { title: issue.title }))) return;
    setArchiving(true);
    const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, {
      ...fetchInit,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setArchiving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("issues.couldNotArchive"));
      return;
    }
    router.push("/issues");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">{t("issueDetail.loading")}</p>
      </div>
    );
  }

  if (loadError || !issue) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-800">{loadError ?? t("issueDetail.notFound")}</p>
          <Link
            href="/issues"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline"
          >
            {t("issueDetail.backToIssues")}
          </Link>
        </div>
      </div>
    );
  }

  const p = issue.project;
  const c = issue.customer;
  const threadTotalPages = Math.max(1, Math.ceil(threadTotal / THREAD_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/issues" className="text-sm font-medium text-zinc-700 underline underline-offset-2">
          ← {t("nav.issues")}
        </Link>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => void archive()}
            disabled={archiving}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {archiving ? t("common.archiving") : t("issueDetail.archiveIssue")}
          </button>
        ) : null}
      </div>

      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("issueDetail.editTitle")}</h1>
        <div className="mt-1 space-y-1 text-sm text-zinc-600">
          {p ? (
            <p>
              {t("issueDetail.projectColon")}{" "}
              <Link
                href={`/projects/${p.id}`}
                className="font-medium text-zinc-900 underline underline-offset-2"
              >
                {p.name}
              </Link>{" "}
              · {p.product}
            </p>
          ) : null}
          {c ? (
            <p className="text-zinc-700">
              {t("issueDetail.customerColon")}{" "}
              <span className="font-medium text-zinc-900">{c.name}</span>
            </p>
          ) : null}
          {!p && !c ? <p className="text-zinc-700">{t("issueDetail.notLinked")}</p> : null}
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          {t("issueDetail.metaLine", {
            name: issue.reporter.name ?? "—",
            at: new Date(issue.createdAt).toLocaleString(),
          })}
        </p>
      </header>

      <form
        onSubmit={save}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold">{t("issueDetail.details")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">{t("common.title")}</span>
            <input
              className="input mt-1 w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <p className="text-xs text-zinc-500 md:col-span-2">{t("issues.linkHint")}</p>
          <label className="block text-sm">
            <span className="text-zinc-600">{t("issueDetail.projectOptional")}</span>
            <select
              className="input mt-1 w-full"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">{t("issues.noProject")}</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} — {proj.product}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">{t("issues.customerOptional")}</span>
            <select
              className="input mt-1 w-full"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">{t("issues.noCustomer")}</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">{t("common.status")}</span>
            <select
              className="input mt-1 w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="OPEN">{t("issueStatus.OPEN")}</option>
              <option value="IN_PROGRESS">{t("issueStatus.IN_PROGRESS")}</option>
              <option value="DONE">{t("issueStatus.DONE")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">{t("common.assignee")}</span>
            <select
              className="input mt-1 w-full"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
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
            <span className="text-zinc-600">{t("common.symptom")}</span>
            <textarea
              className="input mt-1 min-h-[72px] w-full"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">{t("common.cause")}</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">{t("common.solution")}</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600">{t("common.rndContact")}</span>
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
          {saving ? t("common.saving") : t("issueDetail.saveChanges")}
        </button>
      </form>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("issueDetail.attachmentsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("issueDetail.attachmentsHelp")}</p>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="input-file-zone max-w-xl flex-1 min-w-[min(100%,18rem)]">
            <input
              ref={issueFileInputRef}
              type="file"
              multiple
              disabled={uploadingIssueFiles}
              className="input-file"
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) void uploadIssueAttachments(list);
              }}
            />
          </div>
        </div>
        <UploadProgressBar
          value={issueUploadProgress}
          label={t("issueDetail.uploadingFiles")}
          className="mt-3 max-w-xl"
        />
        <div className="mt-4 space-y-3">
          {issue.attachments.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("issueDetail.noAttachments")}</p>
          ) : (
            issue.attachments.map((att) => (
              <div key={att.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                {isImageExt(att.fileType) ? (
                  <a href={att.fileUrl} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.fileUrl}
                      alt=""
                      className="max-h-48 w-auto max-w-full rounded object-contain"
                    />
                  </a>
                ) : null}
                {isVideoExt(att.fileType) ? (
                  <video
                    src={att.fileUrl}
                    controls
                    className="max-h-56 w-full max-w-lg rounded"
                    preload="metadata"
                  />
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a
                    href={att.fileUrl}
                    download={att.fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-zinc-900 underline"
                  >
                    {att.fileName}
                  </a>
                  <span className="text-xs text-zinc-500">{formatBytes(att.fileSize)}</span>
                  <button
                    type="button"
                    onClick={() => void deleteIssueAttachment(att.id)}
                    className="text-xs font-medium text-red-700 underline"
                  >
                    {t("issueDetail.removeFile")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-zinc-900">{t("issueDetail.thread")}</h2>
          <p className="text-sm text-zinc-600">{t("issueDetail.threadHelp")}</p>
          <p className="text-sm text-zinc-500">{t("issueDetail.threadFilesHint")}</p>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-inner">
          <textarea
            className="input min-h-[140px] w-full resize-y text-[15px] leading-relaxed"
            rows={5}
            placeholder={t("issueDetail.threadPlaceholder")}
            value={threadInput}
            onChange={(e) => setThreadInput(e.target.value)}
          />

          {threadFiles.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("issueDetail.threadPendingUploads")}>
              {threadFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}-${f.size}`}
                  className="flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-1 text-xs text-zinc-800 shadow-sm"
                >
                  <span className="max-w-[220px] truncate font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeThreadFile(i)}
                    className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label={t("issueDetail.threadRemoveFileAria", { name: f.name })}
                  >
                    <span aria-hidden className="block text-sm leading-none">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={`thread-attach-${issueId}`}
                ref={threadFileInputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  setThreadFiles(Array.from(e.target.files ?? []));
                }}
              />
              <label
                htmlFor={`thread-attach-${issueId}`}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                {t("issueDetail.chooseFiles")}
              </label>
              {threadFiles.length > 0 ? (
                <button
                  type="button"
                  onClick={clearThreadFiles}
                  className="text-sm font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
                >
                  {t("common.clear")}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-lg border border-blue-700 bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-blue-800 hover:bg-blue-800 disabled:border-zinc-300 disabled:bg-zinc-300 disabled:text-zinc-600 sm:w-auto"
              onClick={() => void postThread()}
              disabled={postingThread}
            >
              {postingThread ? t("issueDetail.posting") : t("issueDetail.post")}
            </button>
          </div>
          <UploadProgressBar
            value={threadUploadProgress}
            label={t("issueDetail.uploadingFiles")}
            className="mt-3"
          />
        </div>
        <div
          className={`mt-6 space-y-3 border-t border-zinc-100 pt-5 ${threadListLoading && threadEntries.length > 0 ? "opacity-60" : ""}`}
        >
          {threadListLoading && threadEntries.length === 0 ? (
            <p className="text-sm text-zinc-600">{t("common.loading")}</p>
          ) : threadEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-6 text-center text-sm text-zinc-500">
              {t("issueDetail.noReplies")}
            </p>
          ) : (
            threadEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                {entry.content ? (
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">{entry.content}</p>
                ) : null}
                {entry.attachments.length > 0 ? (
                  <div className={entry.content ? "mt-3 space-y-3" : "space-y-3"}>
                    {entry.attachments.map((att) => (
                      <div key={att.id} className="rounded-md border border-zinc-200 bg-white p-2">
                        {isImageExt(att.fileType) ? (
                          <a href={att.fileUrl} target="_blank" rel="noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={att.fileUrl}
                              alt=""
                              className="max-h-40 w-auto max-w-full rounded object-contain"
                            />
                          </a>
                        ) : null}
                        {isVideoExt(att.fileType) ? (
                          <video
                            src={att.fileUrl}
                            controls
                            className="max-h-48 w-full max-w-md rounded"
                            preload="metadata"
                          />
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <a
                            href={att.fileUrl}
                            download={att.fileName}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-zinc-900 underline"
                          >
                            {att.fileName}
                          </a>
                          <span className="text-xs text-zinc-500">{formatBytes(att.fileSize)}</span>
                          <button
                            type="button"
                            onClick={() => void deleteThreadAttachment(entry.id, att.id)}
                            className="text-xs font-medium text-red-700 underline"
                          >
                            {t("issueDetail.removeFile")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  {entry.author.name ?? entry.author.email ?? t("common.unknown")}
                  {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString()}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
        {threadTotal > 0 && threadTotalPages > 1 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            <p className="text-xs text-zinc-500">
              {t("issueDetail.threadPageSummary", {
                page: String(threadPage),
                totalPages: String(threadTotalPages),
                total: String(threadTotal),
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={threadPage <= 1 || threadListLoading}
                onClick={() => void loadThreadPage(threadPage - 1)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t("common.previous")}
              </button>
              <button
                type="button"
                disabled={threadPage >= threadTotalPages || threadListLoading}
                onClick={() => void loadThreadPage(threadPage + 1)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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
