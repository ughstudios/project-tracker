"use client";

import { useI18n } from "@/i18n/context";
import { useCallback, useEffect, useMemo, useState } from "react";

type ItemKind = "PROCESSOR" | "RECEIVER_CARD" | "OTHER";

type StockLine = {
  id: string;
  kind: ItemKind;
  model: string;
  firmware: string;
  receiverVersion: string;
  category: string;
  quantity: number;
  notes: string | null;
  location: string | null;
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

const processorGroupNames = new Set([
  "U Series",
  "X100 Pro",
  "Z Series",
  "VX Series",
  "DS Series",
  "S Series",
]);

function StockRow({
  line,
  kindLabel,
  onSaved,
  onDeleted,
}: {
  line: StockLine;
  kindLabel: (k: ItemKind) => string;
  onSaved: (line: StockLine) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [firmware, setFirmware] = useState(line.firmware);
  const [receiverVersion, setReceiverVersion] = useState(line.receiverVersion);
  const [notes, setNotes] = useState(line.notes ?? "");
  const [location, setLocation] = useState(line.location ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setQuantity(String(line.quantity));
    setFirmware(line.firmware);
    setReceiverVersion(line.receiverVersion);
    setNotes(line.notes ?? "");
    setLocation(line.location ?? "");
  }, [line]);

  const save = async () => {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 0) {
      alert(t("inventory.couldNotSave"));
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/inventory/${line.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: q,
        notes: notes.trim() || null,
        location: location.trim() || null,
        ...(line.kind === "PROCESSOR" ? { firmware: firmware.trim() } : {}),
        ...(line.kind === "RECEIVER_CARD"
          ? { receiverVersion: receiverVersion.trim() }
          : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("inventory.couldNotSave"));
      return;
    }
    onSaved((await res.json()) as StockLine);
  };

  const remove = async () => {
    if (!confirm(t("inventory.deleteConfirm"))) return;
    setDeleting(true);
    const res = await fetch(`/api/inventory/${line.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      alert(t("inventory.couldNotDelete"));
      return;
    }
    onDeleted(line.id);
  };

  return (
    <tr className="border-b border-zinc-100 align-top hover:bg-zinc-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04]">
      <td className="px-2 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
        {kindLabel(line.kind)}
      </td>
      <td className="px-2 py-2">
        <div className="font-medium text-zinc-900 dark:text-zinc-100">{line.model}</div>
        {line.kind === "OTHER" ? (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("inventory.category")}: {line.category}
          </div>
        ) : null}
      </td>
      <td className="px-2 py-2">
        {line.kind === "PROCESSOR" ? (
          <input
            className="input w-full min-w-[100px] text-sm"
            value={firmware}
            onChange={(e) => setFirmware(e.target.value)}
          />
        ) : line.kind === "RECEIVER_CARD" ? (
          <input
            className="input w-full min-w-[100px] text-sm"
            value={receiverVersion}
            onChange={(e) => setReceiverVersion(e.target.value)}
          />
        ) : (
          <span className="text-sm text-zinc-400 dark:text-zinc-500">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min={0}
          className="input w-20 text-sm"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className="input w-full min-w-[120px] text-sm"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t("inventory.locationPh")}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className="input w-full min-w-[140px] text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("inventory.notesPh")}
        />
      </td>
      <td className="whitespace-nowrap px-2 py-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary rounded-lg px-2 py-1 text-xs font-semibold"
        >
          {saving ? t("common.saving") : t("inventory.saveRow")}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void remove()}
          className="btn-secondary ml-1 rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50"
        >
          {deleting ? t("inventory.deleting") : t("common.delete")}
        </button>
      </td>
    </tr>
  );
}

export default function InventoryPage() {
  const { t } = useI18n();
  const [lines, setLines] = useState<StockLine[]>([]);
  const [productGroups, setProductGroups] = useState<
    Array<{ group: string; items: string[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filterKind, setFilterKind] = useState<"" | ItemKind>("");
  const [search, setSearch] = useState("");

  const [formKind, setFormKind] = useState<ItemKind>("PROCESSOR");
  const [formModel, setFormModel] = useState("");
  const [formFirmware, setFormFirmware] = useState("");
  const [formReceiverVersion, setFormReceiverVersion] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formQuantity, setFormQuantity] = useState("0");
  const [formNotes, setFormNotes] = useState("");
  const [formLocation, setFormLocation] = useState("");

  const processorModels = useMemo(() => {
    return productGroups
      .filter((g) => processorGroupNames.has(g.group))
      .flatMap((g) => g.items);
  }, [productGroups]);

  const otherGroups = useMemo(() => {
    return productGroups.filter(
      (g) => !processorGroupNames.has(g.group) && g.group !== "Receiver cards",
    );
  }, [productGroups]);

  const kindLabel = useCallback(
    (k: ItemKind) => {
      if (k === "PROCESSOR") return t("inventory.kindProcessor");
      if (k === "RECEIVER_CARD") return t("inventory.kindReceiver");
      return t("inventory.kindOther");
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes, prodRes] = await Promise.all([
      fetch("/api/inventory"),
      fetch("/api/products"),
    ]);
    if (invRes.ok) setLines((await invRes.json()) as StockLine[]);
    else alert(t("inventory.couldNotLoad"));
    if (prodRes.ok) {
      const data = (await prodRes.json()) as {
        groups?: Array<{ group: string; items: string[] }>;
      };
      setProductGroups(data.groups ?? []);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((row) => {
      if (filterKind && row.kind !== filterKind) return false;
      if (!q) return true;
      const hay = [
        row.model,
        row.firmware,
        row.receiverVersion,
        row.category,
        row.notes ?? "",
        row.location ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [lines, filterKind, search]);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(formQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      alert(t("inventory.couldNotAdd"));
      return;
    }
    if (!formModel.trim()) {
      alert(t("inventory.couldNotAdd"));
      return;
    }
    if (formKind === "OTHER" && !formCategory.trim()) {
      alert(t("inventory.couldNotAdd"));
      return;
    }
    setAdding(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: formKind,
        model: formModel.trim(),
        firmware: formKind === "PROCESSOR" ? formFirmware.trim() : "",
        receiverVersion: formKind === "RECEIVER_CARD" ? formReceiverVersion.trim() : "",
        category: formKind === "OTHER" ? formCategory.trim() : "",
        quantity,
        notes: formNotes.trim() || null,
        location: formLocation.trim() || null,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("inventory.couldNotAdd"));
      return;
    }
    const created = (await res.json()) as StockLine;
    setLines((prev) => {
      const idx = prev.findIndex((x) => x.id === created.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = created;
        return next;
      }
      return [...prev, created].sort((a, b) =>
        `${a.kind}${a.model}`.localeCompare(`${b.kind}${b.model}`),
      );
    });
    setFormFirmware("");
    setFormReceiverVersion("");
    setFormQuantity("0");
    setFormNotes("");
    setFormLocation("");
  };

  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("inventory.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("inventory.subtitle")}</p>
      </header>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("inventory.addSection")}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("inventory.addHint")}</p>
        <form onSubmit={submitAdd} className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("inventory.kind")}</span>
            <select
              className="input"
              value={formKind}
              onChange={(e) => {
                const k = e.target.value as ItemKind;
                setFormKind(k);
                setFormModel("");
                setFormCategory("");
              }}
            >
              <option value="PROCESSOR">{t("inventory.kindProcessor")}</option>
              <option value="RECEIVER_CARD">{t("inventory.kindReceiver")}</option>
              <option value="OTHER">{t("inventory.kindOther")}</option>
            </select>
          </label>

          {formKind === "OTHER" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t("inventory.category")}</span>
              <select
                className="input"
                value={formCategory}
                onChange={(e) => {
                  setFormCategory(e.target.value);
                  setFormModel("");
                }}
              >
                <option value="">{t("common.selectCategory")}</option>
                {otherGroups.map((g) => (
                  <option key={g.group} value={g.group}>
                    {g.group}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm md:col-span-2 lg:col-span-1">
            <span className="text-zinc-600 dark:text-zinc-400">{t("inventory.model")}</span>
            <select
              className="input"
              required
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
            >
              <option value="">{t("common.selectModel")}</option>
              {formKind === "PROCESSOR"
                ? processorModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                : null}
              {formKind === "RECEIVER_CARD"
                ? receiverCardModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                : null}
              {formKind === "OTHER"
                ? (otherGroups.find((g) => g.group === formCategory)?.items ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                : null}
            </select>
          </label>

          {formKind === "PROCESSOR" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t("common.firmware")}</span>
              <input
                className="input"
                value={formFirmware}
                onChange={(e) => setFormFirmware(e.target.value)}
                placeholder={t("projects.firmwarePh")}
              />
            </label>
          ) : null}

          {formKind === "RECEIVER_CARD" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{t("projects.cardVersion")}</span>
              <input
                className="input"
                value={formReceiverVersion}
                onChange={(e) => setFormReceiverVersion(e.target.value)}
                placeholder={t("projects.firmwarePh")}
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.quantity")}</span>
            <input
              type="number"
              min={0}
              className="input"
              value={formQuantity}
              onChange={(e) => setFormQuantity(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("inventory.location")}</span>
            <input
              className="input"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder={t("inventory.locationPh")}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">{t("common.details")}</span>
            <input
              className="input"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder={t("inventory.notesPh")}
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={adding}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {adding ? t("common.saving") : t("inventory.addOrUpdate")}
            </button>
          </div>
        </form>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("inventory.listSection")}</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="input text-sm"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as "" | ItemKind)}
            >
              <option value="">{t("inventory.filterAll")}</option>
              <option value="PROCESSOR">{t("inventory.kindProcessor")}</option>
              <option value="RECEIVER_CARD">{t("inventory.kindReceiver")}</option>
              <option value="OTHER">{t("inventory.kindOther")}</option>
            </select>
            <input
              className="input min-w-[200px] text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("inventory.searchPh")}
            />
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("inventory.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("inventory.none")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-white/[0.08] dark:text-zinc-300">
                  <th className="px-2 py-2 font-medium">{t("inventory.kind")}</th>
                  <th className="px-2 py-2 font-medium">{t("inventory.model")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("common.firmware")} / {t("projects.cardVersion")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("common.quantity")}</th>
                  <th className="px-2 py-2 font-medium">{t("inventory.location")}</th>
                  <th className="px-2 py-2 font-medium">{t("common.details")}</th>
                  <th className="px-2 py-2 font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((line) => (
                  <StockRow
                    key={line.id}
                    line={line}
                    kindLabel={kindLabel}
                    onSaved={(next) =>
                      setLines((prev) => prev.map((x) => (x.id === next.id ? next : x)))
                    }
                    onDeleted={(id) => setLines((prev) => prev.filter((x) => x.id !== id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
