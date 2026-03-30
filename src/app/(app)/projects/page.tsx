"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Customer = { id: string; name: string };
type ProcessorConfig = { model: string; firmware: string; quantity: number };
type ReceiverCardConfig = { model: string; version: string; quantity: number };
type OtherProductConfig = { category: string; model: string; quantity: number };
type Project = {
  id: string;
  name: string;
  product: string;
  customer: Customer;
  processorConfigs?: ProcessorConfig[];
  receiverCardConfigs?: ReceiverCardConfig[];
  otherProductConfigs?: OtherProductConfig[];
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    createdAt?: string;
  }>;
  notes?: Array<{
    id: string;
    content: string;
    createdAt?: string;
    author?: { id: string; name: string | null; email: string | null };
  }>;
  issues?: Array<{ id: string; title: string; status: string }>;
  _count?: { issues: number };
};

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

export default function ProjectsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [productGroups, setProductGroups] = useState<
    Array<{ group: string; items: string[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", customerId: "" });
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [processors, setProcessors] = useState<ProcessorConfig[]>([
    { model: "", firmware: "", quantity: 1 },
  ]);
  const [receiverCards, setReceiverCards] = useState<ReceiverCardConfig[]>([
    { model: "", version: "", quantity: 1 },
  ]);
  const [otherProducts, setOtherProducts] = useState<OtherProductConfig[]>([
    { category: "", model: "", quantity: 1 },
  ]);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [postingNoteProjectId, setPostingNoteProjectId] = useState<string | null>(null);
  const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [cRes, pRes, prodRes] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/projects"),
      fetch("/api/products"),
    ]);
    if (cRes.ok) setCustomers(await cRes.json());
    if (pRes.ok) setProjects(await pRes.json());
    if (prodRes.ok) {
      const data = (await prodRes.json()) as {
        groups?: Array<{ group: string; items: string[] }>;
      };
      setProductGroups(data.groups ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.name, p.product, p.customer?.name ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [projects, query]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    // Safety guard: never create until the final wizard step.
    if (wizardStep < 4) {
      setWizardStep((s) => (s === 4 ? 4 : (s + 1) as 1 | 2 | 3 | 4));
      return;
    }

    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        processorConfigs: processors,
        receiverCardConfigs: receiverCards,
        otherProductConfigs: otherProducts,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Could not create project. Make sure customer is selected.");
      return;
    }
    setForm({ name: "", customerId: "" });
    setProcessors([{ model: "", firmware: "", quantity: 1 }]);
    setReceiverCards([{ model: "", version: "", quantity: 1 }]);
    setOtherProducts([{ category: "", model: "", quantity: 1 }]);
    setWizardStep(1);
    await load();
  };

  const addNote = async (projectId: string) => {
    const content = (noteInputs[projectId] ?? "").trim();
    if (!content) return;
    setPostingNoteProjectId(projectId);
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setPostingNoteProjectId(null);
    if (!res.ok) {
      alert("Could not add note.");
      return;
    }
    setNoteInputs((prev) => ({ ...prev, [projectId]: "" }));
    await load();
  };

  const uploadAttachment = async (projectId: string, file: File | null) => {
    if (!file) return;
    setUploadingProjectId(projectId);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/attachments`, {
      method: "POST",
      body: formData,
    });
    setUploadingProjectId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "Could not upload file.");
      return;
    }
    await load();
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

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Create projects and link them to a customer.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Create Project Wizard</h2>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
          <span className={wizardStep === 1 ? "font-semibold text-zinc-900" : ""}>1. Basic</span>
          <span>→</span>
          <span className={wizardStep === 2 ? "font-semibold text-zinc-900" : ""}>2. Processors</span>
          <span>→</span>
          <span className={wizardStep === 3 ? "font-semibold text-zinc-900" : ""}>3. Receiver cards</span>
          <span>→</span>
          <span className={wizardStep === 4 ? "font-semibold text-zinc-900" : ""}>4. Other products</span>
        </div>
        <form onSubmit={create} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          {wizardStep === 1 && (
            <>
              <input
                className="input md:col-span-3"
                placeholder="Project name"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <select
                className="input"
                required
                value={form.customerId}
                onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="md:col-span-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Product is derived from selections in steps 2, 3, and 4.
              </p>
            </>
          )}

          {wizardStep === 2 && (
            <div className="md:col-span-4 space-y-2">
              {processors.map((item, idx) => (
                <div key={`proc-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <select
                    className="input"
                    value={item.model}
                    onChange={(e) =>
                      setProcessors((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, model: e.target.value } : p)),
                      )
                    }
                  >
                    <option value="">Select processor model</option>
                    {productGroups
                      .filter((g) =>
                        ["U Series", "X100 Pro", "Z Series", "VX Series", "DS Series", "S Series"]
                          .includes(g.group),
                      )
                      .flatMap((g) => g.items)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Firmware (e.g. 1.2.3)"
                    value={item.firmware}
                    onChange={(e) =>
                      setProcessors((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, firmware: e.target.value } : p)),
                      )
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      setProcessors((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, quantity: Number(e.target.value || 1) } : p,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      setProcessors((prev) =>
                        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                onClick={() =>
                  setProcessors((prev) => [...prev, { model: "", firmware: "", quantity: 1 }])
                }
              >
                + Add processor line
              </button>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="md:col-span-4 space-y-2">
              {receiverCards.map((item, idx) => (
                <div key={`rx-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <select
                    className="input"
                    value={item.model}
                    onChange={(e) =>
                      setReceiverCards((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, model: e.target.value } : r)),
                      )
                    }
                  >
                    <option value="">Select receiver card model</option>
                    {receiverCardModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Card version"
                    value={item.version}
                    onChange={(e) =>
                      setReceiverCards((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, version: e.target.value } : r)),
                      )
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      setReceiverCards((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, quantity: Number(e.target.value || 1) } : r,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      setReceiverCards((prev) =>
                        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                onClick={() =>
                  setReceiverCards((prev) => [...prev, { model: "", version: "", quantity: 1 }])
                }
              >
                + Add receiver line
              </button>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="md:col-span-4 space-y-2">
              {otherProducts.map((item, idx) => (
                <div key={`other-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <select
                    className="input"
                    value={item.category}
                    onChange={(e) =>
                      setOtherProducts((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, category: e.target.value, model: "" } : r,
                        ),
                      )
                    }
                  >
                    <option value="">Select category</option>
                    {otherGroups.map((g) => (
                      <option key={g.group} value={g.group}>
                        {g.group}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={item.model}
                    onChange={(e) =>
                      setOtherProducts((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, model: e.target.value } : r)),
                      )
                    }
                  >
                    <option value="">Select product</option>
                    {(otherGroups.find((g) => g.group === item.category)?.items ?? []).map((m) => (
                      <option key={`${item.category}:${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      setOtherProducts((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, quantity: Number(e.target.value || 1) } : r,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      setOtherProducts((prev) =>
                        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                onClick={() =>
                  setOtherProducts((prev) => [
                    ...prev,
                    { category: "", model: "", quantity: 1 },
                  ])
                }
              >
                + Add other product line
              </button>
            </div>
          )}

          <div className="md:col-span-4 flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={wizardStep === 1}
              onClick={() =>
                setWizardStep((s) => (s === 1 ? 1 : (s - 1) as 1 | 2 | 3 | 4))
              }
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Back
            </button>
            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setWizardStep((s) => (s === 4 ? 4 : (s + 1) as 1 | 2 | 3 | 4));
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
              >
                {saving ? "Creating..." : "Create Project"}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Project List</h2>
          <input
            className="input w-full md:w-80"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-600">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No projects found.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <th className="border border-zinc-200 px-2 py-2">Project</th>
                  <th className="border border-zinc-200 px-2 py-2">Product</th>
                  <th className="border border-zinc-200 px-2 py-2">Customer</th>
                  <th className="border border-zinc-200 px-2 py-2">Hardware Summary</th>
                  <th className="border border-zinc-200 px-2 py-2">Issues</th>
                  <th className="border border-zinc-200 px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="odd:bg-white even:bg-zinc-50/50">
                    <td className="border border-zinc-200 px-2 py-2 font-medium">{p.name}</td>
                    <td className="border border-zinc-200 px-2 py-2">{p.product}</td>
                    <td className="border border-zinc-200 px-2 py-2">{p.customer?.name ?? "-"}</td>
                    <td className="border border-zinc-200 px-2 py-2">
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-semibold">Processors:</span>{" "}
                          {(p.processorConfigs ?? []).length === 0
                            ? "-"
                            : p.processorConfigs
                                ?.map((x) => `${x.model} fw ${x.firmware || "-"} x${x.quantity}`)
                                .join(", ")}
                        </div>
                        <div>
                          <span className="font-semibold">Receiver cards:</span>{" "}
                          {(p.receiverCardConfigs ?? []).length === 0
                            ? "-"
                            : p.receiverCardConfigs
                                ?.map((x) => `${x.model} v${x.version || "-"} x${x.quantity}`)
                                .join(", ")}
                        </div>
                        <div>
                          <span className="font-semibold">Other products:</span>{" "}
                          {(p.otherProductConfigs ?? []).length === 0
                            ? "-"
                            : p.otherProductConfigs
                                ?.map((x) => `${x.category}: ${x.model} x${x.quantity}`)
                                .join(", ")}
                        </div>
                        <details className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
                          <summary className="cursor-pointer text-xs font-semibold text-zinc-700">
                            Project attachments, issues, and notes
                          </summary>
                          <div className="mt-2 space-y-3">
                            <div>
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                                Attach config file (.rcvbp/.cbp)
                              </p>
                              <input
                                type="file"
                                accept=".rcvbp,.cbp"
                                onChange={(e) =>
                                  uploadAttachment(p.id, e.currentTarget.files?.[0] ?? null)
                                }
                              />
                              {uploadingProjectId === p.id ? (
                                <p className="text-[11px] text-zinc-500">Uploading...</p>
                              ) : null}
                              <ul className="mt-1 list-disc pl-4">
                                {(p.attachments ?? []).map((a) => (
                                  <li key={a.id}>
                                    <a
                                      href={a.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-700 hover:underline"
                                    >
                                      {a.fileName}
                                    </a>{" "}
                                    ({Math.round((a.fileSize ?? 0) / 1024)} KB)
                                  </li>
                                ))}
                                {(p.attachments ?? []).length === 0 ? <li>-</li> : null}
                              </ul>
                            </div>

                            <div>
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                                Linked issues
                              </p>
                              <ul className="list-disc pl-4">
                                {(p.issues ?? []).map((issue) => (
                                  <li key={issue.id}>
                                    {issue.title} ({issue.status})
                                  </li>
                                ))}
                                {(p.issues ?? []).length === 0 ? <li>-</li> : null}
                              </ul>
                            </div>

                            <div>
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                                Notes
                              </p>
                              <div className="mb-2 flex gap-2">
                                <input
                                  className="input"
                                  placeholder="Add a project note..."
                                  value={noteInputs[p.id] ?? ""}
                                  onChange={(e) =>
                                    setNoteInputs((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                                  onClick={() => addNote(p.id)}
                                  disabled={postingNoteProjectId === p.id}
                                >
                                  {postingNoteProjectId === p.id ? "Saving..." : "Add"}
                                </button>
                              </div>
                              <ul className="space-y-1">
                                {(p.notes ?? []).map((n) => (
                                  <li key={n.id} className="rounded border border-zinc-200 bg-white px-2 py-1">
                                    <div>{n.content}</div>
                                    <div className="text-[10px] text-zinc-500">
                                      {n.author?.name ?? "Unknown"}{" "}
                                      {n.createdAt
                                        ? `• ${new Date(n.createdAt).toLocaleString()}`
                                        : ""}
                                    </div>
                                  </li>
                                ))}
                                {(p.notes ?? []).length === 0 ? <li>-</li> : null}
                              </ul>
                            </div>
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className="border border-zinc-200 px-2 py-2">{p._count?.issues ?? 0}</td>
                    <td className="border border-zinc-200 px-2 py-2">
                      <Link href={`/projects/${p.id}`} className="text-blue-700 hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

