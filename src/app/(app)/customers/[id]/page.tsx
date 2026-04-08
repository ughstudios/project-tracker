"use client";

import { useI18n } from "@/i18n/context";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CustomerAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
};

export default function CustomerDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const customerId = params.id;

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [projectCount, setProjectCount] = useState(0);
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    const res = await fetch(`/api/customers/${customerId}`);
    if (!res.ok) {
      setLoading(false);
      setMissing(true);
      setName("");
      setAttachments([]);
      setProjectCount(0);
      return;
    }
    const data = (await res.json()) as {
      name: string;
      attachments?: CustomerAttachment[];
      _count?: { projects: number };
    };
    setName(data.name ?? "");
    setAttachments(data.attachments ?? []);
    setProjectCount(data._count?.projects ?? 0);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const uploadAttachments = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    const formData = new FormData();
    for (const f of Array.from(fileList)) {
      formData.append("files", f);
    }
    const res = await fetch(`/api/customers/${customerId}/attachments`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("customerDetail.couldNotUpload"));
      return;
    }
    await load();
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!confirm(t("customerDetail.confirmRemoveAttachment"))) return;
    const res = await fetch(`/api/customers/${customerId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("common.attachmentRemoveFailed"));
      return;
    }
    await load();
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
        <div className="input-file-zone max-w-xl">
          <input
            type="file"
            multiple
            className="input-file"
            onChange={(e) => {
              void uploadAttachments(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          {uploading ? <p className="mt-2 text-xs text-zinc-500">{t("customerDetail.uploading")}</p> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {t("customerDetail.uploadedFiles", { count: String(attachments.length) })}
          </p>
          {attachments.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">{t("customerDetail.noFiles")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <a
                    href={a.fileUrl}
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
