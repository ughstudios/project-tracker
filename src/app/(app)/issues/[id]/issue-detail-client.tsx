"use client";

import { AttachmentNoteInlineEditor } from "@/components/attachment-note-inline-editor";
import { UploadProgressBar } from "@/components/upload-progress-bar";
import { useI18n } from "@/i18n/context";
import type { Locale } from "@/i18n/types";
import { uploadFilesViaBlobClient } from "@/lib/blob-client-upload";
import { attachmentBlobHref } from "@/lib/attachment-blob-href";
import { getLocalizedText } from "@/lib/translated-content";
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
  uploadNote: string;
  createdAt: string;
  uploader: { id: string; name: string | null; email: string | null } | null;
};

type ThreadEntry = {
  id: string;
  content: string;
  contentTranslated: string | null;
  contentLanguage: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string | null };
  attachments: IssueFileAttachment[];
};

type IssueDetail = {
  id: string;
  title: string;
  titleTranslated: string | null;
  status: string;
  symptom: string;
  symptomTranslated: string | null;
  cause: string;
  causeTranslated: string | null;
  solution: string;
  solutionTranslated: string | null;
  contentLanguage: string | null;
  rndContact: string;
  createdAt: string;
  archivedAt: string | null;
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

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/mp4",
};

function AttachmentVideo({
  fileUrl,
  fileType,
  fileName,
  className,
}: {
  fileUrl: string;
  fileType: string;
  fileName: string;
  className: string;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const href = attachmentBlobHref(fileUrl);
  const mime = VIDEO_MIME[fileType.toLowerCase()] ?? `video/${fileType}`;

  return (
    <div>
      <video
        controls
        playsInline
        preload="auto"
        className={className}
        onError={() => setFailed(true)}
      >
        <source src={href} type={mime} />
      </video>
      {failed ? (
        <p className="mt-2 text-sm text-amber-900">
          {t("issueDetail.videoPlayFailed")}{" "}
          <a
            href={attachmentBlobHref(fileUrl, { asDownload: true })}
            className="font-medium text-amber-950 underline"
            download={fileName}
          >
            {t("issueDetail.videoDownloadInstead")}
          </a>
        </p>
      ) : null}
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function withAttachmentDefaults(data: IssueDetail): IssueDetail {
  return {
    ...data,
    archivedAt: data.archivedAt ?? null,
    attachments: (data.attachments ?? []).map((a) => ({
      ...a,
      uploadNote: a.uploadNote ?? "",
    })),
  };
}

const THREAD_PAGE_SIZE = 10;

const fetchInit: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

function TranslationPreview({
  original,
  translated,
  sourceLanguage,
  locale,
  t,
}: {
  original: string;
  translated: string | null;
  sourceLanguage: string | null;
  locale: Locale;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const localized = getLocalizedText({
    original,
    translated,
    sourceLanguage,
    locale,
  });
  if (!localized.usedTranslation) return null;

  return (
    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-sky-800/50 dark:bg-sky-950/35 dark:text-sky-100">
      <p className="font-medium">
        {t("common.autoTranslatedFrom", {
          language: t(`language.${localized.sourceLanguage ?? "en"}`),
        })}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{localized.text}</p>
    </div>
  );
}

function ThreadContent({
  content,
  contentTranslated,
  contentLanguage,
  locale,
  t,
}: {
  content: string;
  contentTranslated: string | null;
  contentLanguage: string | null;
  locale: Locale;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const localized = getLocalizedText({
    original: content,
    translated: contentTranslated,
    sourceLanguage: contentLanguage,
    locale,
  });

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{localized.text}</p>
      {localized.usedTranslation ? (
        <details className="text-xs text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer select-none">
            {t("common.originalText")}
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{content}</p>
        </details>
      ) : null}
    </div>
  );
}

export function IssueDetailClient({ issueId }: { issueId: string }) {
  const router = useRouter();
  const { t, locale } = useI18n();

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
  const [issueUploadNote, setIssueUploadNote] = useState("");
  const [threadUploadNote, setThreadUploadNote] = useState("");
  const [threadUploadProgress, setThreadUploadProgress] = useState<number | null>(null);
  const issueFileInputRef = useRef<HTMLInputElement>(null);
  const [archiving, setArchiving] = useState(false);
  const [threadEntries, setThreadEntries] = useState<ThreadEntry[]>([]);
  const [threadPage, setThreadPage] = useState(1);
  const [threadTotal, setThreadTotal] = useState(0);
  const [threadListLoading, setThreadListLoading] = useState(false);
  const loadThreadPage = useCallback(
    async (page: number | "last") => {
      setThreadListLoading(true);
      try {
        const q = page === "last" ? "page=last" : `page=${page}`;
        const res = await fetch(
          `/api/issues/${encodeURIComponent(issueId)}/thread?${q}&pageSize=${THREAD_PAGE_SIZE}&_=${Date.now()}`,
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
            attachments: (e.attachments ?? []).map((a) => ({
              ...a,
              uploadNote: a.uploadNote ?? "",
            })),
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

  useEffect(() => {
    if (threadFiles.length === 0) {
      setThreadUploadNote("");
      if (threadFileInputRef.current) threadFileInputRef.current.value = "";
    }
  }, [threadFiles.length]);

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
        const [issueRes, threadRes, usersRes, projectsRes, customersRes] =
          await Promise.all([
            fetch(`/api/issues/${encodeURIComponent(issueId)}`, fetchInit),
            fetch(
              `/api/issues/${encodeURIComponent(issueId)}/thread?page=1&pageSize=${THREAD_PAGE_SIZE}&_=${Date.now()}`,
              fetchInit,
            ),
            fetch("/api/users", fetchInit),
            fetch("/api/projects", fetchInit),
            fetch("/api/customers", fetchInit),
          ]);
        if (cancelled) return;
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
                attachments: (e.attachments ?? []).map((a) => ({
                  ...a,
                  uploadNote: a.uploadNote ?? "",
                })),
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
    const res = await fetch(
      `/api/issues/${encodeURIComponent(issueId)}?_${Date.now()}`,
      fetchInit,
    );
    if (!res.ok) return;
    const data = withAttachmentDefaults((await res.json()) as IssueDetail);
    if (data.id !== issueId) return;
    setIssue(data);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (issue?.archivedAt) return;
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
    const note = issueUploadNote.trim();
    if (!note) {
      alert(t("common.attachmentUploadNoteRequiredAlert"));
      if (issueFileInputRef.current) issueFileInputRef.current.value = "";
      return;
    }
    setUploadingIssueFiles(true);
    setIssueUploadProgress(0);
    try {
      const up = await uploadFilesViaBlobClient({
        files,
        tokenExtras: { scope: "issue", issueId },
        completeUrl: `/api/issues/${encodeURIComponent(issueId)}/attachments/complete`,
        uploadNote: note,
        onProgress: (p) => setIssueUploadProgress(p === null ? -1 : p),
      });
      if (issueFileInputRef.current) issueFileInputRef.current.value = "";
      if (!up.ok) {
        alert(up.error ?? t("issueDetail.couldNotUpload"));
        return;
      }
      setIssueUploadNote("");
      await refreshIssue();
    } finally {
      setUploadingIssueFiles(false);
      setIssueUploadProgress(null);
    }
  };

  const saveIssueAttachmentNote = async (attachmentId: string, note: string): Promise<boolean> => {
    const res = await fetch(
      `/api/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        ...fetchInit,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadNote: note }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("common.attachmentNoteSaveFailed"));
      return false;
    }
    const { attachment } = (await res.json()) as { attachment: IssueFileAttachment };
    setIssue((prev) =>
      prev
        ? {
            ...prev,
            attachments: prev.attachments.map((a) =>
              a.id === attachmentId ? { ...a, uploadNote: attachment.uploadNote } : a,
            ),
          }
        : prev,
    );
    router.refresh();
    return true;
  };

  const saveThreadAttachmentNote = async (
    entryId: string,
    attachmentId: string,
    note: string,
  ): Promise<boolean> => {
    const res = await fetch(
      `/api/issues/${encodeURIComponent(issueId)}/thread/${encodeURIComponent(entryId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        ...fetchInit,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadNote: note }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("common.attachmentNoteSaveFailed"));
      return false;
    }
    const { attachment } = (await res.json()) as { attachment: IssueFileAttachment };
    setThreadEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              attachments: e.attachments.map((a) =>
                a.id === attachmentId ? { ...a, uploadNote: attachment.uploadNote } : a,
              ),
            }
          : e,
      ),
    );
    router.refresh();
    return true;
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
    setIssue((prev) =>
      prev
        ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) }
        : prev,
    );
    await refreshIssue();
    router.refresh();
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
    setThreadEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, attachments: e.attachments.filter((a) => a.id !== attachmentId) }
          : e,
      ),
    );
    await loadThreadPage(threadPage);
    router.refresh();
  };

  const postThread = async () => {
    const content = threadInput.trim();
    if (!content && threadFiles.length === 0) return;
    if (threadFiles.length > 0 && !threadUploadNote.trim()) {
      alert(t("common.attachmentUploadNoteRequiredAlert"));
      return;
    }
    setPostingThread(true);
    try {
      if (threadFiles.length > 0) {
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
            uploadNote: threadUploadNote.trim(),
            onProgress: (p) => setThreadUploadProgress(p === null ? -1 : p),
          });
          if (!up.ok) {
            alert(up.error ?? t("issueDetail.couldNotPost"));
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
      setThreadUploadNote("");
      if (threadFileInputRef.current) threadFileInputRef.current.value = "";
      await loadThreadPage("last");
    } finally {
      setPostingThread(false);
    }
  };

  const removeThreadFile = (index: number) => {
    setThreadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearThreadFiles = () => {
    setThreadFiles([]);
    setThreadUploadNote("");
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("issueDetail.loading")}</p>
      </div>
    );
  }

  if (loadError || !issue) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">{loadError ?? t("issueDetail.notFound")}</p>
          <Link
            href="/issues"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 dark:text-zinc-100 underline"
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
  const readOnly = Boolean(issue.archivedAt);
  const issueTranslationActive = [
    getLocalizedText({
      original: issue.title,
      translated: issue.titleTranslated,
      sourceLanguage: issue.contentLanguage,
      locale,
    }).usedTranslation,
    getLocalizedText({
      original: issue.symptom,
      translated: issue.symptomTranslated,
      sourceLanguage: issue.contentLanguage,
      locale,
    }).usedTranslation,
    getLocalizedText({
      original: issue.cause,
      translated: issue.causeTranslated,
      sourceLanguage: issue.contentLanguage,
      locale,
    }).usedTranslation,
    getLocalizedText({
      original: issue.solution,
      translated: issue.solutionTranslated,
      sourceLanguage: issue.contentLanguage,
      locale,
    }).usedTranslation,
  ].some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={readOnly ? "/archive" : "/issues"}
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300 underline underline-offset-2"
        >
          ← {readOnly ? t("issueDetail.backToArchive") : t("nav.issues")}
        </Link>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => void archive()}
            disabled={archiving}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {archiving ? t("common.archiving") : t("issueDetail.archiveIssue")}
          </button>
        ) : null}
      </div>

      {readOnly ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <p>{t("issueDetail.archivedReadOnlyBanner")}</p>
          {issue.archivedAt ? (
            <p className="mt-1 text-xs text-amber-900/90">
              {t("issueDetail.archivedAtLabel", {
                at: new Date(issue.archivedAt).toLocaleString(),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {issueTranslationActive ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 shadow-sm dark:border-sky-800/50 dark:bg-sky-950/35 dark:text-sky-100">
          {t("issueDetail.translationBanner", {
            language: t(`language.${issue.contentLanguage ?? "en"}`),
          })}
        </div>
      ) : null}

      <header className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h1 className="text-xl font-semibold">
          {readOnly ? t("issueDetail.viewArchivedTitle") : t("issueDetail.editTitle")}
        </h1>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("issues.ticketId")}:</span>{" "}
          <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 break-all">{issue.id}</span>
        </p>
        <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {p ? (
            <p>
              {t("issueDetail.projectColon")}{" "}
              <Link
                href={`/projects/${p.id}`}
                className="font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
              >
                {p.name}
              </Link>{" "}
              · {p.product}
            </p>
          ) : null}
          {c ? (
            <p className="text-zinc-700 dark:text-zinc-300">
              {t("issueDetail.customerColon")}{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
            </p>
          ) : null}
          {!p && !c ? <p className="text-zinc-700 dark:text-zinc-300">{t("issueDetail.notLinked")}</p> : null}
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {t("issueDetail.metaLine", {
            name: issue.reporter.name ?? "—",
            at: new Date(issue.createdAt).toLocaleString(),
          })}
        </p>
      </header>

      <form
        onSubmit={save}
        className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold">{t("issueDetail.details")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.title")}</span>
            <input
              className="input mt-1 w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={readOnly}
            />
            <TranslationPreview
              original={title}
              translated={issue.titleTranslated}
              sourceLanguage={issue.contentLanguage}
              locale={locale}
              t={t}
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 md:col-span-2">{t("issues.linkHint")}</p>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("issueDetail.projectOptional")}</span>
            <select
              className="input mt-1 w-full"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={readOnly}
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
            <span className="text-zinc-600 dark:text-zinc-400">{t("issues.customerOptional")}</span>
            <select
              className="input mt-1 w-full"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={readOnly}
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
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.status")}</span>
            <select
              className="input mt-1 w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={readOnly}
            >
              <option value="OPEN">{t("issueStatus.OPEN")}</option>
              <option value="IN_PROGRESS">{t("issueStatus.IN_PROGRESS")}</option>
              <option value="DONE">{t("issueStatus.DONE")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.assignee")}</span>
            <select
              className="input mt-1 w-full"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={readOnly}
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
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              required
              disabled={readOnly}
            />
            <TranslationPreview
              original={symptom}
              translated={issue.symptomTranslated}
              sourceLanguage={issue.contentLanguage}
              locale={locale}
              t={t}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.cause")}</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              disabled={readOnly}
            />
            <TranslationPreview
              original={cause}
              translated={issue.causeTranslated}
              sourceLanguage={issue.contentLanguage}
              locale={locale}
              t={t}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.solution")}</span>
            <textarea
              className="input mt-1 min-h-[64px] w-full"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              disabled={readOnly}
            />
            <TranslationPreview
              original={solution}
              translated={issue.solutionTranslated}
              sourceLanguage={issue.contentLanguage}
              locale={locale}
              t={t}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.rndContact")}</span>
            <input
              className="input mt-1 w-full"
              value={rndContact}
              onChange={(e) => setRndContact(e.target.value)}
              disabled={readOnly}
            />
          </label>
        </div>
        {readOnly ? null : (
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:bg-zinc-50 dark:bg-zinc-9500"
          >
            {saving ? t("common.saving") : t("issueDetail.saveChanges")}
          </button>
        )}
      </form>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("issueDetail.attachmentsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("issueDetail.attachmentsHelp")}</p>
        {readOnly ? null : (
          <>
            <label className="mt-3 block max-w-xl text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t("common.attachmentUploadNoteLabel")}</span>
              <textarea
                className="input mt-1 min-h-[64px] w-full"
                value={issueUploadNote}
                onChange={(e) => setIssueUploadNote(e.target.value)}
                placeholder={t("common.attachmentUploadNotePlaceholder")}
                disabled={uploadingIssueFiles}
              />
            </label>
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
          </>
        )}
        <div className="mt-4 space-y-3">
          {issue.attachments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("issueDetail.noAttachments")}</p>
          ) : (
            issue.attachments.map((att) => (
              <div key={att.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-3">
                {isImageExt(att.fileType) ? (
                  <a
                    href={attachmentBlobHref(att.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachmentBlobHref(att.fileUrl)}
                      alt=""
                      className="max-h-48 w-auto max-w-full rounded object-contain"
                    />
                  </a>
                ) : null}
                {isVideoExt(att.fileType) ? (
                  <AttachmentVideo
                    fileUrl={att.fileUrl}
                    fileType={att.fileType}
                    fileName={att.fileName}
                    className="max-h-56 w-full max-w-lg rounded"
                  />
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a
                    href={attachmentBlobHref(att.fileUrl, { asDownload: true })}
                    download={att.fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-100 underline"
                  >
                    {att.fileName}
                  </a>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatBytes(att.fileSize)}</span>
                  {readOnly ? null : (
                    <button
                      type="button"
                      onClick={() => void deleteIssueAttachment(att.id)}
                      className="text-xs font-medium text-red-700 underline"
                    >
                      {t("issueDetail.removeFile")}
                    </button>
                  )}
                </div>
                <AttachmentNoteInlineEditor
                  uploadNote={att.uploadNote}
                  readOnly={readOnly}
                  onSave={(note) => saveIssueAttachmentNote(att.id, note)}
                />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("issueDetail.thread")}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {readOnly ? t("issueDetail.threadHelpArchived") : t("issueDetail.threadHelp")}
          </p>
          {readOnly ? null : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("issueDetail.threadFilesHint")}</p>
          )}
        </div>

        {readOnly ? null : (
        <div className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-inner">
          <textarea
            className="input min-h-[140px] w-full resize-y text-[15px] leading-relaxed"
            rows={5}
            placeholder={t("issueDetail.threadPlaceholder")}
            value={threadInput}
            onChange={(e) => setThreadInput(e.target.value)}
          />

          {threadFiles.length > 0 ? (
            <label className="mt-3 block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t("common.attachmentUploadNoteLabel")}</span>
              <textarea
                className="input mt-1 min-h-[64px] w-full"
                value={threadUploadNote}
                onChange={(e) => setThreadUploadNote(e.target.value)}
                placeholder={t("common.attachmentUploadNotePlaceholder")}
                disabled={postingThread}
              />
            </label>
          ) : null}
          {threadFiles.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("issueDetail.threadPendingUploads")}>
              {threadFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}-${f.size}`}
                  className="flex max-w-full items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 pl-3 pr-1 text-xs text-zinc-800 dark:text-zinc-200 shadow-sm"
                >
                  <span className="max-w-[220px] truncate font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeThreadFile(i)}
                    className="rounded-full p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:text-zinc-200"
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

          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-700/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-sm transition hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              >
                {t("issueDetail.chooseFiles")}
              </label>
              {threadFiles.length > 0 ? (
                <button
                  type="button"
                  onClick={clearThreadFiles}
                  className="text-sm font-medium text-zinc-500 dark:text-zinc-400 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:text-zinc-200"
                >
                  {t("common.clear")}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-lg border border-blue-700 bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-blue-800 hover:bg-blue-800 disabled:border-zinc-300 disabled:bg-zinc-300 disabled:text-zinc-600 dark:border-sky-600 dark:bg-sky-600 dark:hover:border-sky-500 dark:hover:bg-sky-500 dark:disabled:border-zinc-600 dark:disabled:bg-zinc-600 dark:disabled:text-zinc-400 sm:w-auto"
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
        )}
        <div
          className={`${readOnly ? "mt-5" : "mt-6"} space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-5 ${threadListLoading && threadEntries.length > 0 ? "opacity-60" : ""}`}
        >
          {threadListLoading && threadEntries.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("common.loading")}</p>
          ) : threadEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/50 px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t("issueDetail.noReplies")}
            </p>
          ) : (
            threadEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-3">
                {entry.content ? (
                  <ThreadContent
                    content={entry.content}
                    contentTranslated={entry.contentTranslated}
                    contentLanguage={entry.contentLanguage}
                    locale={locale}
                    t={t}
                  />
                ) : null}
                {entry.attachments.length > 0 ? (
                  <div className={entry.content ? "mt-3 space-y-3" : "space-y-3"}>
                    {entry.attachments.map((att) => (
                      <div key={att.id} className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2">
                        {isImageExt(att.fileType) ? (
                          <a
                            href={attachmentBlobHref(att.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={attachmentBlobHref(att.fileUrl)}
                              alt=""
                              className="max-h-40 w-auto max-w-full rounded object-contain"
                            />
                          </a>
                        ) : null}
                        {isVideoExt(att.fileType) ? (
                          <AttachmentVideo
                            fileUrl={att.fileUrl}
                            fileType={att.fileType}
                            fileName={att.fileName}
                            className="max-h-48 w-full max-w-md rounded"
                          />
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <a
                            href={attachmentBlobHref(att.fileUrl, { asDownload: true })}
                            download={att.fileName}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 underline"
                          >
                            {att.fileName}
                          </a>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatBytes(att.fileSize)}</span>
                          {readOnly ? null : (
                            <button
                              type="button"
                              onClick={() => void deleteThreadAttachment(entry.id, att.id)}
                              className="text-xs font-medium text-red-700 underline"
                            >
                              {t("issueDetail.removeFile")}
                            </button>
                          )}
                        </div>
                        <AttachmentNoteInlineEditor
                          uploadNote={att.uploadNote}
                          borderClassName="border-zinc-100 dark:border-zinc-800"
                          readOnly={readOnly}
                          onSave={(note) => saveThreadAttachmentNote(entry.id, att.id, note)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {entry.author.name ?? entry.author.email ?? t("common.unknown")}
                  {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString()}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
        {threadTotal > 0 && threadTotalPages > 1 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("common.previous")}
              </button>
              <button
                type="button"
                disabled={threadPage >= threadTotalPages || threadListLoading}
                onClick={() => void loadThreadPage(threadPage + 1)}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800 disabled:opacity-50"
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
