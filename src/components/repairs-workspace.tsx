"use client";

import { RepairRow, RepairStatus, groupRepairUnits, normalizeStatus, repairUnitTotal } from "@/lib/repairs";
import { useEffect, useMemo, useState } from "react";

type RepairsWorkspaceProps = {
  mode: "table" | "dashboard";
};

const statusLabels: Record<RepairStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

function inputClassName(extra = "") {
  return ["input w-full", extra].filter(Boolean).join(" ");
}

function useRepairs() {
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRepairs() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/repairs", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { repairs: RepairRow[] };
      setRepairs(data.repairs);
    } catch {
      setError("Could not load repairs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRepairs();
  }, []);

  async function updateRepair(id: string, patch: Partial<RepairRow>) {
    const previous = repairs;
    setRepairs((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, ...patch, status: patch.status ? normalizeStatus(patch.status) : row.status } : row,
      ),
    );

    const response = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setRepairs(previous);
      setError("Could not save repair changes.");
      return;
    }
    const data = (await response.json()) as { repair: RepairRow };
    setRepairs((rows) => rows.map((row) => (row.id === id ? data.repair : row)));
  }

  async function addRepair() {
    const response = await fetch("/api/repairs", { method: "POST" });
    if (!response.ok) {
      setError("Could not add repair.");
      return;
    }
    const data = (await response.json()) as { repair: RepairRow };
    setRepairs((rows) => [data.repair, ...rows]);
  }

  async function removeRepair(id: string) {
    const row = repairs.find((repair) => repair.id === id);
    if (!window.confirm(`Delete repair row "${row?.model || id}"?`)) return;
    const previous = repairs;
    setRepairs((rows) => rows.filter((repair) => repair.id !== id));
    const response = await fetch(`/api/repairs/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      setRepairs(previous);
      setError("Could not delete repair.");
    }
  }

  return { repairs, updateRepair, addRepair, removeRepair, loading, error };
}

export function RepairsWorkspace({ mode }: RepairsWorkspaceProps) {
  const { repairs, updateRepair, addRepair, removeRepair, loading, error } = useRepairs();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | RepairStatus>("ALL");

  const employees = useMemo(() => {
    const names = new Set<string>();
    repairs.forEach((row) => {
      if (row.assignedTo.trim()) names.add(row.assignedTo.trim());
      if (row.repairedBy.trim()) names.add(row.repairedBy.trim());
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [repairs]);

  const filteredRepairs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repairs.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [row.model, row.repairType, row.company, row.rmaNumber, row.assignedTo, row.repairedBy, row.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, repairs, statusFilter]);

  if (loading) {
    return <div className="panel-surface rounded-xl p-4 text-sm text-zinc-600 dark:text-zinc-400">Loading repairs...</div>;
  }

  if (mode === "dashboard") {
    return <RepairsDashboard repairs={repairs} error={error} />;
  }

  return (
    <>
      {error ? <p className="mb-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">Search</span>
          <input
            className="input w-72 max-w-full"
            placeholder="Model, company, RMA, employee..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">Status</span>
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | RepairStatus)}>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          onClick={addRepair}
        >
          Add repair
        </button>
      </div>

      <datalist id="repair-employees">
        {employees.map((employee) => (
          <option key={employee} value={employee} />
        ))}
      </datalist>

      <div className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-[1180px] w-full border-collapse text-sm" aria-label="Editable repairs table">
          <thead>
            <tr className="bg-zinc-100 text-xs uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <th className="px-2 py-2 text-left">Qty</th>
              <th className="px-2 py-2 text-left">Processor</th>
              <th className="px-2 py-2 text-left">Repair</th>
              <th className="px-2 py-2 text-left">Company</th>
              <th className="px-2 py-2 text-left">RMA #</th>
              <th className="px-2 py-2 text-left">RMA form</th>
              <th className="px-2 py-2 text-left">Assigned to</th>
              <th className="px-2 py-2 text-left">Repaired by</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Notes</th>
              <th className="px-2 py-2 text-left">Updated</th>
              <th className="px-2 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.map((row) => (
              <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="w-20 px-2 py-2 align-top">
                  <input
                    className={inputClassName()}
                    min={0}
                    type="number"
                    value={row.quantity}
                    onChange={(event) => void updateRepair(row.id, { quantity: Number.parseInt(event.target.value, 10) || 0 })}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} value={row.model} onChange={(event) => void updateRepair(row.id, { model: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} value={row.repairType} onChange={(event) => void updateRepair(row.id, { repairType: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} value={row.company} onChange={(event) => void updateRepair(row.id, { company: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} value={row.rmaNumber} onChange={(event) => void updateRepair(row.id, { rmaNumber: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} placeholder="https://..." value={row.rmaFormUrl} onChange={(event) => void updateRepair(row.id, { rmaFormUrl: event.target.value })} />
                  {row.rmaFormUrl ? <a className="mt-1 block text-xs text-zinc-500 underline" href={row.rmaFormUrl} target="_blank" rel="noreferrer">Open form</a> : null}
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} list="repair-employees" value={row.assignedTo} onChange={(event) => void updateRepair(row.id, { assignedTo: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top">
                  <input className={inputClassName()} list="repair-employees" value={row.repairedBy} onChange={(event) => void updateRepair(row.id, { repairedBy: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top">
                  <select className={inputClassName()} value={row.status} onChange={(event) => void updateRepair(row.id, { status: normalizeStatus(event.target.value) })}>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </td>
                <td className="px-2 py-2 align-top">
                  <textarea className={inputClassName()} rows={2} value={row.notes} onChange={(event) => void updateRepair(row.id, { notes: event.target.value })} />
                </td>
                <td className="px-2 py-2 align-top text-xs text-zinc-500">{new Date(row.updatedAt).toLocaleDateString()}</td>
                <td className="px-2 py-2 align-top">
                  <button type="button" className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => void removeRepair(row.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RepairsDashboard({ repairs, error }: { repairs: RepairRow[]; error: string }) {
  const openRepairs = repairs.filter((row) => row.status !== "DONE");
  const completedRepairs = repairs.filter((row) => row.status === "DONE");
  const companyGroups = groupRepairUnits(repairs, "company");
  const assignedGroups = groupRepairUnits(openRepairs, "assignedTo");
  const repairedByGroups = groupRepairUnits(completedRepairs, "repairedBy");

  return (
    <section className="space-y-4" aria-label="Repair dashboard summary">
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Repair rows" value={repairs.length} />
        <Metric label="Processor units" value={repairUnitTotal(repairs)} />
        <Metric label="Open repair units" value={repairUnitTotal(openRepairs)} />
        <Metric label="Completed repair units" value={repairUnitTotal(completedRepairs)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SummaryPanel title="Repairs by company" rows={companyGroups} empty="No companies assigned yet." />
        <SummaryPanel title="Open repairs by assignee" rows={assignedGroups} empty="No assigned open repairs yet." />
        <SummaryPanel title="Completed repairs by employee" rows={repairedByGroups} empty="No completed repairs yet." />
        <div className="panel-surface rounded-xl p-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent repair rows</h2>
          <ul className="mt-3 space-y-2">
            {[...repairs]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 8)
              .map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2 text-sm last:border-b-0 dark:border-zinc-800">
                  <span>
                    {row.quantity} x {row.model || "Unnamed processor"}
                    <br />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{row.company || "No company"} - {row.assignedTo || "Unassigned"}</span>
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{statusLabels[row.status]}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <dl className="panel-surface rounded-xl p-4">
      <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
    </dl>
  );
}

function SummaryPanel({ title, rows, empty }: { title: string; rows: Array<{ label: string; count: number }>; empty: string }) {
  return (
    <div className="panel-surface rounded-xl p-4">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 10).map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2 text-sm last:border-b-0 dark:border-zinc-800">
              <span>{row.label}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
