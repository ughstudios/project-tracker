"use client";

import { AttachmentNoteInlineEditor } from "@/components/attachment-note-inline-editor";
import { UploadProgressBar } from "@/components/upload-progress-bar";
import { useI18n } from "@/i18n/context";
import { attachmentBlobHref } from "@/lib/attachment-blob-href";
import { uploadFilesViaBlobClient } from "@/lib/blob-client-upload";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Customer = { id: string; name: string };
type ProcessorConfig = { model: string; firmware: string; quantity: number };
type ReceiverCardConfig = { model: string; version: string; quantity: number };
type OtherProductConfig = { category: string; model: string; quantity: number };
type ProjectNote = {
  id: string;
  content: string;
  createdAt?: string;
  author?: { id: string; name: string | null; email: string | null };
};
type ProjectAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadNote: string;
};
type ProjectIssue = {
  id: string;
  title: string;
  status: string;
};

const apiFetch: RequestInit = { credentials: "include", cache: "no-store" };

const receiverCardModels = [
  "5G Series - HC5",
  "5G Series - RV5000",
  "K10",
  "K5+",
  "K8",
  "E320 Pro",
  "E120",
  "E80",
  "5A-75E",
  "5A-75B",
];

function routeSegmentId(value: string | string[] | undefined): string {
  if (value == null) return "";
  return typeof value === "string" ? value : value[0] ?? "";
}

export default function ProjectDetailsPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string | string[] }>();
  const projectId = routeSegmentId(params.id);

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productGroups, setProductGroups] = useState<Array<{ group: string; items: string[] }>>(
    [],
  );
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [processors, setProcessors] = useState<ProcessorConfig[]>([]);
  const [receiverCards, setReceiverCards] = useState<ReceiverCardConfig[]>([]);
  const [otherProducts, setOtherProducts] = useState<OtherProductConfig[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileUploadNote, setFileUploadNote] = useState("");
  const [archivedAt, setArchivedAt] = useState<string | null>(null);

  type ProjectPayload = {
    name: string;
    customerId: string;
    archivedAt?: string | null;
    processorConfigs: ProcessorConfig[];
    receiverCardConfigs: ReceiverCardConfig[];
    otherProductConfigs: OtherProductConfig[];
    notes?: ProjectNote[];
    attachments?: ProjectAttachment[];
    issues?: ProjectIssue[];
  };

  const applyProjectPayload = useCallback((project: ProjectPayload) => {
    setName(project.name ?? "");
    setCustomerId(project.customerId ?? "");
    setArchivedAt(project.archivedAt ?? null);
    setProcessors(project.processorConfigs?.length ? project.processorConfigs : [{ model: "", firmware: "", quantity: 1 }]);
    setReceiverCards(
      project.receiverCardConfigs?.length
        ? project.receiverCardConfigs
        : [{ model: "", version: "", quantity: 1 }],
    );
    setOtherProducts(
      project.otherProductConfigs?.length
        ? project.otherProductConfigs
        : [{ category: "", model: "", quantity: 1 }],
    );
    setNotes(project.notes ?? []);
    setAttachments(
      (project.attachments ?? []).map((a) => ({
        ...a,
        uploadNote: a.uploadNote ?? "",
      })),
    );
    setIssues(project.issues ?? []);
  }, []);

  const load = useCallback(
    async (mode: "full" | "projectOnly" = "full") => {
      if (mode === "full") setLoading(true);
      if (mode === "full") setMissing(false);

      if (mode === "projectOnly") {
        const projectRes = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}?_${Date.now()}`,
          apiFetch,
        );
        if (projectRes.ok) {
          applyProjectPayload((await projectRes.json()) as ProjectPayload);
        }
        return;
      }

      const [projectRes, customersRes, productsRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}?_${Date.now()}`, apiFetch),
        fetch("/api/customers", apiFetch),
        fetch("/api/products", apiFetch),
      ]);
      if (!projectRes.ok) {
        setMissing(true);
        setLoading(false);
        return;
      }
      applyProjectPayload((await projectRes.json()) as ProjectPayload);

      if (customersRes.ok) setCustomers(await customersRes.json());
      if (productsRes.ok) {
        const data = (await productsRes.json()) as {
          groups?: Array<{ group: string; items: string[] }>;
        };
        setProductGroups(data.groups ?? []);
      }
      setLoading(false);
    },
    [projectId, applyProjectPayload],
  );

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      ...apiFetch,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        customerId,
        processorConfigs: processors,
        receiverCardConfigs: receiverCards,
        otherProductConfigs: otherProducts,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert(t("projectDetail.couldNotSave"));
      return;
    }
    alert(t("projectDetail.updated"));
    await load();
  };

  const addNote = async () => {
    const content = noteInput.trim();
    if (!content) return;
    setAddingNote(true);
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      ...apiFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setAddingNote(false);
    if (!res.ok) {
      alert(t("projectDetail.couldNotAddNote"));
      return;
    }
    setNoteInput("");
    await load();
  };

  const uploadAttachments = async (fileList: FileList | null): Promise<boolean> => {
    if (!fileList?.length || !projectId) return false;
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
        tokenExtras: { scope: "project", projectId },
        completeUrl: `/api/projects/${projectId}/attachments/complete`,
        uploadNote: note,
        onProgress: (p) => setUploadProgress(p === null ? -1 : p),
      });
      if (!up.ok) {
        alert(up.error ?? t("projectDetail.couldNotUpload"));
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

  const saveProjectAttachmentNote = async (attachmentId: string, note: string): Promise<boolean> => {
    const res = await fetch(`/api/projects/${projectId}/attachments/${attachmentId}`, {
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
    const { attachment } = (await res.json()) as { attachment: ProjectAttachment };
    setAttachments((prev) =>
      prev.map((a) => (a.id === attachmentId ? { ...a, uploadNote: attachment.uploadNote } : a)),
    );
    return true;
  };

  const deleteProjectAttachment = async (attachmentId: string) => {
    if (!confirm(t("projectDetail.confirmRemoveAttachment"))) return;
    const res = await fetch(`/api/projects/${projectId}/attachments/${attachmentId}`, {
      ...apiFetch,
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("common.attachmentRemoveFailed"));
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    await load("projectOnly");
  };

  const processorGroups = new Set([
    "U Series",
    "X100 Pro",
    "Z Series",
    "VX Series",
    "DS Series",
    "S Series",
  ]);
  const otherGroups = productGroups.filter(
    (g) => !processorGroups.has(g.group) && g.group !== "Receiver cards",
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {t("projectDetail.loading")}
      </div>
    );
  }

  if (missing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">{t("projects.noneFound")}</p>
          <Link href="/projects" className="mt-2 inline-block text-sm text-blue-700 hover:underline">
            {t("projectDetail.backToProjects")}
          </Link>
        </div>
      </div>
    );
  }

  const readOnly = Boolean(archivedAt);

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {readOnly ? t("projectDetail.viewArchivedTitle") : t("projectDetail.editTitle")}
          </h1>
          <Link href={readOnly ? "/archive" : "/projects"} className="text-sm text-blue-700 hover:underline">
            {readOnly ? t("issueDetail.backToArchive") : t("projectDetail.backToProjects")}
          </Link>
        </div>
      </header>

      {readOnly ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <p>{t("projectDetail.archivedReadOnlyBanner")}</p>
          <p className="mt-1 text-xs text-amber-900/90">
            {t("projectDetail.archivedAtLabel", {
              at: new Date(archivedAt ?? "").toLocaleString(),
            })}
          </p>
        </div>
      ) : null}

      <form onSubmit={save} className="space-y-4">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="input md:col-span-2" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={readOnly}>
            <option value="">{t("common.selectCustomer")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-base font-semibold">Processors</h2>
          {processors.map((item, idx) => (
            <div key={`p-${idx}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className="input" value={item.model} onChange={(e) => setProcessors((prev) => prev.map((x, i) => i === idx ? { ...x, model: e.target.value } : x))} disabled={readOnly}>
                <option value="">{t("common.selectModel")}</option>
                {productGroups.filter((g) => processorGroups.has(g.group)).flatMap((g) => g.items).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input className="input" placeholder="Firmware" value={item.firmware} onChange={(e) => setProcessors((prev) => prev.map((x, i) => i === idx ? { ...x, firmware: e.target.value } : x))} disabled={readOnly} />
              <input className="input" type="number" min={1} value={item.quantity} onChange={(e) => setProcessors((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value || 1) } : x))} disabled={readOnly} />
              {readOnly ? null : <button type="button" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={() => setProcessors((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}>{t("common.remove")}</button>}
            </div>
          ))}
          {readOnly ? null : <button type="button" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={() => setProcessors((prev) => [...prev, { model: "", firmware: "", quantity: 1 }])}>{t("projects.addProcessorLine")}</button>}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-base font-semibold">Receiver cards</h2>
          {receiverCards.map((item, idx) => (
            <div key={`r-${idx}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className="input" value={item.model} onChange={(e) => setReceiverCards((prev) => prev.map((x, i) => i === idx ? { ...x, model: e.target.value } : x))} disabled={readOnly}>
                <option value="">{t("common.selectModel")}</option>
                {receiverCardModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input className="input" placeholder={t("common.version")} value={item.version} onChange={(e) => setReceiverCards((prev) => prev.map((x, i) => i === idx ? { ...x, version: e.target.value } : x))} disabled={readOnly} />
              <input className="input" type="number" min={1} value={item.quantity} onChange={(e) => setReceiverCards((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value || 1) } : x))} disabled={readOnly} />
              {readOnly ? null : <button type="button" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={() => setReceiverCards((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}>Remove</button>}
            </div>
          ))}
          {readOnly ? null : <button type="button" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={() => setReceiverCards((prev) => [...prev, { model: "", version: "", quantity: 1 }])}>{t("projects.addReceiverLine")}</button>}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-base font-semibold">{t("projectDetail.otherProducts")}</h2>
          {otherProducts.map((item, idx) => (
            <div key={`o-${idx}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className="input" value={item.category} onChange={(e) => setOtherProducts((prev) => prev.map((x, i) => i === idx ? { ...x, category: e.target.value, model: "" } : x))} disabled={readOnly}>
                <option value="">{t("common.selectCategory")}</option>
                {otherGroups.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
              </select>
              <select className="input" value={item.model} onChange={(e) => setOtherProducts((prev) => prev.map((x, i) => i === idx ? { ...x, model: e.target.value } : x))} disabled={readOnly}>
                <option value="">Select product</option>
                {(otherGroups.find((g) => g.group === item.category)?.items ?? []).map((m) => (
                  <option key={`${item.category}:${m}`} value={m}>{m}</option>
                ))}
              </select>
              <input className="input" type="number" min={1} value={item.quantity} onChange={(e) => setOtherProducts((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value || 1) } : x))} disabled={readOnly} />
              {readOnly ? null : <button type="button" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={() => setOtherProducts((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}>{t("common.remove")}</button>}
            </div>
          ))}
          {readOnly ? null : <button type="button" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={() => setOtherProducts((prev) => [...prev, { category: "", model: "", quantity: 1 }])}>+ Add other product line</button>}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">{t("projectDetail.filesTitle")}</h2>
          <p className="text-sm text-zinc-600">{t("projectDetail.filesHelp")}</p>
          {readOnly ? null : (
            <>
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
                label={t("projectDetail.uploading")}
                className="mt-2 max-w-xl"
              />
            </>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              {t("projectDetail.uploadedFiles", { count: String(attachments.length) })}
            </p>
            {attachments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">{t("projectDetail.noFiles")}</p>
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
                        {readOnly ? null : (
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100"
                            onClick={() => void deleteProjectAttachment(a.id)}
                          >
                            {t("common.delete")}
                          </button>
                        )}
                      </div>
                    </div>
                    <AttachmentNoteInlineEditor
                      uploadNote={a.uploadNote}
                      borderClassName="border-zinc-100"
                      readOnly={readOnly}
                      onSave={(note) => saveProjectAttachmentNote(a.id, note)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-base font-semibold">{t("projectDetail.linkedIssues")}</h2>
          <p className="text-sm text-zinc-600">{t("projectDetail.linkedIssuesHelp")}</p>
          {issues.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("projectDetail.noLinkedIssues")}</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {issues.map((issue) => (
                <li key={issue.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <Link href={`/issues/${issue.id}`} className="min-w-0 text-blue-700 hover:underline">
                    <span className="block font-mono text-[11px] text-zinc-500 break-all">
                      {issue.id}
                    </span>
                    <span className="block font-medium">{issue.title}</span>
                  </Link>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                    {issue.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-base font-semibold">{t("projectDetail.notesTitle")}</h2>
          {readOnly ? null : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                className="input min-h-[120px] w-full flex-1 resize-y sm:min-h-[100px]"
                rows={5}
                placeholder={t("projectDetail.notePlaceholder")}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                onClick={addNote}
                disabled={addingNote}
              >
                {addingNote ? t("projectDetail.adding") : t("projectDetail.addNote")}
              </button>
            </div>
          )}
          <ul className="space-y-1">
            {notes.map((n) => (
              <li key={n.id} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm">
                <div className="whitespace-pre-wrap">{n.content}</div>
                <div className="text-[11px] text-zinc-500">
                  {n.author?.name ?? n.author?.email ?? t("common.unknown")}{" "}
                  {n.createdAt ? `• ${new Date(n.createdAt).toLocaleString()}` : ""}
                </div>
              </li>
            ))}
            {notes.length === 0 ? <li className="text-sm text-zinc-500">{t("common.noNotes")}</li> : null}
          </ul>
        </section>

        {readOnly ? null : (
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700" disabled={saving}>
            {saving ? t("common.saving") : t("projectDetail.saveChanges")}
          </button>
        )}
      </form>
    </div>
  );
}

