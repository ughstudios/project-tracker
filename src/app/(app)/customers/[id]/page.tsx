"use client";

import { AttachmentNoteInlineEditor } from "@/components/attachment-note-inline-editor";
import { UploadProgressBar } from "@/components/upload-progress-bar";
import { useI18n } from "@/i18n/context";
import { attachmentBlobHref } from "@/lib/attachment-blob-href";
import { uploadFilesViaBlobClient } from "@/lib/blob-client-upload";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CustomerAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadNote: string;
};

const apiFetch: RequestInit = { credentials: "include", cache: "no-store" };

function routeSegmentId(value: string | string[] | undefined): string {
  if (value == null) return "";
  return typeof value === "string" ? value : value[0] ?? "";
}

export default function CustomerDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string | string[] }>();
  const customerId = routeSegmentId(params.id);

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [projectCount, setProjectCount] = useState(0);
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileUploadNote, setFileUploadNote] = useState("");
  const load = useCallback(async (mode: "full" | "customerOnly" = "full") => {
    if (mode === "full") {
      setLoading(true);
      setMissing(false);
    }
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}?_${Date.now()}`, apiFetch);
    if (!res.ok) {
      if (mode === "full") {
        setLoading(false);
        setMissing(true);
        setName("");
        setAttachments([]);
        setProjectCount(0);
      }
      return;
    }
    const data = (await res.json()) as {
      name: string;
      attachments?: CustomerAttachment[];
      _count?: { projects: number };
    };
    setName(data.name ?? "");
    setAttachments(
      (data.attachments ?? []).map((a) => ({
        ...a,
        uploadNote: a.uploadNote ?? "",
      })),
    );
    setProjectCount(data._count?.projects ?? 0);
    if (mode === "full") setLoading(false);
  }, [customerId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const uploadAttachments = async (fileList: FileList | null): Promise<boolean> => {
    if (!fileList?.length || !customerId) return false;
    const note = fileUploadNote.trim();
    if (!note) {
      alert(t("common.attachmentUploadNoteRequiredAlert"));
      return false;
    }
    const files = Array.from(fileList);
    setUploading(true);
    setUploadProgress(0);
    try {
      const up = await uploadFilesViaBlobClient({
        files,
        tokenExtras: { scope: "customer", customerId },
        completeUrl: `/api/customers/${customerId}/attachments/complete`,
        uploadNote: note,
        onProgress: (p) => setUploadProgress(p === null ? -1 : p),
      });
      if (!up.ok) {
        alert(up.error ?? t("customerDetail.couldNotUpload"));
        return false;
      }
      setFileUploadNote("");
      await load();
      return true;
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const saveCustomerAttachmentNote = async (attachmentId: string, note: string): Promise<boolean> => {
    const res = await fetch(`/api/customers/${customerId}/attachments/${attachmentId}`, {
      ...apiFetch,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadNote: note }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("common.attachmentNoteSaveFailed"));
      return false;
    }
    const { attachment } = (await res.json()) as { attachment: CustomerAttachment };
    setAttachments((prev) =>
      prev.map((a) => (a.id === attachmentId ? { ...a, uploadNote: attachment.uploadNote } : a)),
    );
    return true;
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!confirm(t("customerDetail.confirmRemoveAttachment"))) return;
    const res = await fetch(`/api/customers/${customerId}/attachments/${attachmentId}`, {
      ...apiFetch,
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("common.attachmentRemoveFailed"));
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    await load("customerOnly");
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {t("customerDetail.loading")}
      </div>
    );
  }

  if (missing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">{t("customers.notFound")}</p>
          <Link href="/customers" className="mt-2 inline-block text-sm text-blue-700 hover:underline">
            {t("customerDetail.backToCustomers")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">
              {t("customerDetail.title")}: {name}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{t("customerDetail.subtitle")}</p>
            <p className="mt-1 text-sm text-zinc-700">
              {t("customerDetail.projectsCount", { count: String(projectCount) })}
            </p>
            <Link
              href={`/projects?customer=${encodeURIComponent(customerId)}`}
              className="mt-0.5 inline-block text-sm text-blue-700 hover:underline"
            >
              {t("customers.viewProjectsFor", { name })}
            </Link>
          </div>
          <Link href="/customers" className="text-sm text-blue-700 hover:underline">
            {t("customerDetail.backToCustomers")}
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-base font-semibold">{t("customerDetail.filesTitle")}</h2>
        <p className="text-sm text-zinc-600">{t("customerDetail.filesHelp")}</p>
        <label className="block max-w-xl text-sm">
          <span className="text-zinc-600">{t("common.attachmentUploadNoteLabel")}</span>
          <textarea
            className="input mt-1 min-h-[64px] w-full"
            value={fileUploadNote}
            onChange={(e) => setFileUploadNote(e.target.value)}
            placeholder={t("common.attachmentUploadNotePlaceholder")}
            disabled={uploading}
          />
        </label>
        <div className="input-file-zone mt-3 max-w-xl">
          <input
            type="file"
            multiple
            disabled={uploading}
            className="input-file"
            onChange={(e) => {
              const el = e.currentTarget;
              void uploadAttachments(el.files).then((ok) => {
                if (ok) el.value = "";
              });
            }}
          />
        </div>
        <UploadProgressBar
          value={uploadProgress}
          label={t("customerDetail.uploading")}
          className="mt-2 max-w-xl"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {t("customerDetail.uploadedFiles", { count: String(attachments.length) })}
          </p>
          {attachments.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">{t("customerDetail.noFiles")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {attachments.map((a) => (
                <li key={a.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={attachmentBlobHref(a.fileUrl, { asDownload: true })}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-blue-700 hover:underline"
                    >
                      {a.fileName}
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-zinc-500">{Math.round((a.fileSize ?? 0) / 1024)} KB</span>
                      <button
                        type="button"
                        className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100"
                        onClick={() => void deleteAttachment(a.id)}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                  <AttachmentNoteInlineEditor
                    uploadNote={a.uploadNote}
                    borderClassName="border-zinc-100"
                    onSave={(note) => saveCustomerAttachmentNote(a.id, note)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
