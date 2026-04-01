"use client";

import { useI18n } from "@/i18n/context";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const { t } = useI18n();
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
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
      const sessionRes = await fetch("/api/auth/session");
      if (sessionRes.ok) {
        const session = (await sessionRes.json()) as { user?: { role?: string } };
        setIsAdmin(session.user?.role === "ADMIN");
      }
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
      alert(t("projects.couldNotCreate"));
      return;
    }
    setForm({ name: "", customerId: "" });
    setProcessors([{ model: "", firmware: "", quantity: 1 }]);
    setReceiverCards([{ model: "", version: "", quantity: 1 }]);
    setOtherProducts([{ category: "", model: "", quantity: 1 }]);
    setWizardStep(1);
    await load();
  };

  const archiveProject = async (projectId: string, projectName: string) => {
    const confirmed = confirm(t("projects.archiveConfirm", { name: projectName }));
    if (!confirmed) return;
    setArchivingProjectId(projectId);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setArchivingProjectId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("projects.couldNotArchive"));
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
        <h1 className="text-xl font-semibold">{t("projects.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("projects.subtitle")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("projects.wizardTitle")}</h2>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
          <span className={wizardStep === 1 ? "font-semibold text-zinc-900" : ""}>
            {t("projects.step1")}
          </span>
          <span>→</span>
          <span className={wizardStep === 2 ? "font-semibold text-zinc-900" : ""}>
            {t("projects.step2")}
          </span>
          <span>→</span>
          <span className={wizardStep === 3 ? "font-semibold text-zinc-900" : ""}>
            {t("projects.step3")}
          </span>
          <span>→</span>
          <span className={wizardStep === 4 ? "font-semibold text-zinc-900" : ""}>
            {t("projects.step4")}
          </span>
        </div>
        <form onSubmit={create} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          {wizardStep === 1 && (
            <>
              <input
                className="input md:col-span-3"
                placeholder={t("projects.projectName")}
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
                <option value="">{t("common.selectCustomer")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="md:col-span-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                {t("projects.productDerivedHint")}
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
                    <option value="">{t("projects.selectProcessorModel")}</option>
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
                    placeholder={t("projects.firmwarePh")}
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
                    placeholder={t("projects.qty")}
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
                    {t("common.remove")}
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
                {t("projects.addProcessorLine")}
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
                    <option value="">{t("projects.selectReceiverModel")}</option>
                    {receiverCardModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder={t("projects.cardVersion")}
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
                    placeholder={t("projects.qty")}
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
                    {t("common.remove")}
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
                {t("projects.addReceiverLine")}
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
                    <option value="">{t("common.selectCategory")}</option>
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
                    <option value="">{t("common.selectProduct")}</option>
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
                    placeholder={t("projects.qty")}
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
                    {t("common.remove")}
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
                {t("projects.addOtherLine")}
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
              {t("projects.back")}
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
                {t("common.next")}
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
              >
                {saving ? t("common.creating") : t("projects.createProject")}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("projects.listTitle")}</h2>
          <input
            className="input w-full md:w-80"
            placeholder={t("projects.searchPh")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-600">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">{t("projects.noneFound")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <th className="border border-zinc-200 px-2 py-2">{t("projects.colProject")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("projects.colProduct")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("projects.colCustomer")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("projects.colHardware")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("projects.colIssues")}</th>
                  <th className="border border-zinc-200 px-2 py-2">{t("common.actions")}</th>
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
                          <span className="font-semibold">{t("projects.processors")}</span>{" "}
                          {(p.processorConfigs ?? []).length === 0
                            ? "-"
                            : p.processorConfigs
                                ?.map((x) => `${x.model} fw ${x.firmware || "-"} x${x.quantity}`)
                                .join(", ")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("projects.receivers")}</span>{" "}
                          {(p.receiverCardConfigs ?? []).length === 0
                            ? "-"
                            : p.receiverCardConfigs
                                ?.map((x) => `${x.model} v${x.version || "-"} x${x.quantity}`)
                                .join(", ")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("projects.otherProducts")}</span>{" "}
                          {(p.otherProductConfigs ?? []).length === 0
                            ? "-"
                            : p.otherProductConfigs
                                ?.map((x) => `${x.category}: ${x.model} x${x.quantity}`)
                                .join(", ")}
                        </div>
                      </div>
                    </td>
                    <td className="border border-zinc-200 px-2 py-2">{p._count?.issues ?? 0}</td>
                    <td className="border border-zinc-200 px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/projects/${p.id}`} className="text-blue-700 hover:underline">
                          {t("projects.open")}
                        </Link>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                            onClick={() => archiveProject(p.id, p.name)}
                            disabled={archivingProjectId === p.id}
                          >
                            {archivingProjectId === p.id ? t("common.archiving") : t("common.archive")}
                          </button>
                        ) : null}
                      </div>
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

