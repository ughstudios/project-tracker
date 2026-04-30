"use client";

import {
  RepairRow,
  RepairStatus,
  groupRepairUnits,
  normalizeStatus,
  repairUnitTotal,
} from "@/lib/repairs";
import { REPAIR_PRODUCT_OPTIONS } from "@/lib/repair-products";
import Link from "next/link";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type RepairsWorkspaceProps = {
  mode: "table" | "dashboard";
};

type CustomerOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string; email: string };

const statusLabels: Record<RepairStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

function inputClassName(extra = "") {
  return [
    "h-8 w-full rounded-none border-0 bg-transparent px-2 py-1 text-sm text-zinc-950 outline-none",
    "focus:bg-white focus:shadow-[inset_0_0_0_2px_#217346]",
    "dark:text-zinc-100 dark:focus:bg-[#111827]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function EditableTextCell({
  value,
  onCommit,
  multiline = false,
  extraClassName = "",
}: {
  value: string;
  onCommit: (value: string) => Promise<void>;
  multiline?: boolean;
  extraClassName?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  async function commit() {
    setEditing(false);
    if (draft === value) return;
    setSaving(true);
    try {
      await onCommit(draft);
    } finally {
      setSaving(false);
    }
  }

  const className = inputClassName(
    [
      multiline ? "min-h-8 resize-none leading-6" : "",
      saving ? "opacity-70" : "",
      extraClassName,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const sharedProps = {
    className,
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onFocus: () => setEditing(true),
    onBlur: () => void commit(),
    onKeyDown: (
      event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  };

  return multiline ? (
    <textarea rows={1} {...sharedProps} />
  ) : (
    <input {...sharedProps} />
  );
}

function useRepairs() {
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRepairs() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/repairs", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        repairs: RepairRow[];
        customers: CustomerOption[];
        employees: EmployeeOption[];
      };
      setRepairs(data.repairs);
      setCustomers(data.customers ?? []);
      setEmployees(data.employees ?? []);
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
        row.id === id
          ? {
              ...row,
              ...patch,
              status: patch.status ? normalizeStatus(patch.status) : row.status,
            }
          : row,
      ),
    );

    const response = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setRepairs(previous);
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data.error ?? "Could not save repair changes.");
      return;
    }
    const data = (await response.json()) as { repair: RepairRow };
    setRepairs((rows) =>
      rows.map((row) => (row.id === id ? data.repair : row)),
    );
  }

  async function addRepair() {
    const response = await fetch("/api/repairs", { method: "POST" });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data.error ?? "Could not add repair.");
      return;
    }
    const data = (await response.json()) as { repair: RepairRow };
    setRepairs((rows) => [data.repair, ...rows]);
  }

  async function archiveRepairRow(id: string) {
    const row = repairs.find((repair) => repair.id === id);
    if (!window.confirm(`Archive repair row "${row?.model || id}"?`)) return;
    const previous = repairs;
    setRepairs((rows) => rows.filter((repair) => repair.id !== id));
    const response = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setRepairs(previous);
      setError("Could not archive repair.");
    }
  }

  return {
    repairs,
    customers,
    employees,
    updateRepair,
    addRepair,
    archiveRepairRow,
    loading,
    error,
  };
}

export function RepairsWorkspace({ mode }: RepairsWorkspaceProps) {
  const {
    repairs,
    customers,
    employees,
    updateRepair,
    addRepair,
    archiveRepairRow,
    loading,
    error,
  } = useRepairs();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | RepairStatus>("ALL");
  const customersByName = useMemo(
    () => new Map(customers.map((customer) => [customer.name, customer])),
    [customers],
  );

  const filteredRepairs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repairs.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [
        row.model,
        row.issueDescription,
        row.company,
        row.contactName,
        row.contactEmail,
        row.phoneNumber,
        row.rmaNumber,
        row.firmware,
        row.serialNumber,
        row.purchaseNumber,
        row.datePurchased,
        row.usageEnvironment,
        row.mailingAddress,
        row.repairedBy,
        row.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, repairs, statusFilter]);

  if (loading) {
    return (
      <div className="panel-surface rounded-xl p-4 text-sm text-zinc-600 dark:text-zinc-400">
        Loading repairs...
      </div>
    );
  }

  if (mode === "dashboard") {
    return <RepairsDashboard repairs={repairs} error={error} />;
  }

  return (
    <>
      {error ? (
        <p className="mb-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      <div className="overflow-hidden border border-[#a6a6a6] bg-white shadow-sm dark:border-zinc-700 dark:bg-[#111827]">
        <div className="flex flex-wrap items-end gap-2 border-b border-[#b7b7b7] bg-[#f3f2f1] px-2 py-2 text-xs dark:border-zinc-700 dark:bg-[#1f2937]">
          <label className="block">
            <span className="mb-1 block font-semibold text-zinc-700 dark:text-zinc-200">
              Search
            </span>
            <input
              className="h-8 w-72 max-w-full border border-[#a6a6a6] bg-white px-2 text-sm text-zinc-950 outline-none focus:border-[#217346] focus:shadow-[0_0_0_1px_#217346] dark:border-zinc-600 dark:bg-[#111827] dark:text-zinc-100"
              placeholder="Model, issue, company, RMA, contact..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-zinc-700 dark:text-zinc-200">
              Status
            </span>
            <select
              className="h-8 border border-[#a6a6a6] bg-white px-2 text-sm text-zinc-950 outline-none focus:border-[#217346] focus:shadow-[0_0_0_1px_#217346] dark:border-zinc-600 dark:bg-[#111827] dark:text-zinc-100"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | RepairStatus)
              }
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </select>
          </label>
          <button
            type="button"
            className="h-8 border border-[#185c37] bg-[#217346] px-3 text-sm font-semibold text-white hover:bg-[#185c37] disabled:opacity-60"
            onClick={addRepair}
          >
            + Add row
          </button>
          <div className="ml-auto hidden text-right text-xs text-zinc-500 dark:text-zinc-400 sm:block">
            {filteredRepairs.length} rows
          </div>
        </div>

        <div className="max-h-[calc(100vh-220px)] overflow-auto">
          <table
            className="w-full table-fixed border-collapse text-sm"
            aria-label="Editable repairs spreadsheet"
          >
            <colgroup>
              <col className="w-10" />
              <col className="w-[15%]" />
              <col className="w-[25%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-20" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10 bg-[#217346] text-left text-xs font-semibold uppercase tracking-normal text-white">
                <th className="border-r border-[#185c37] px-2 py-2 text-center">
                  #
                </th>
                <th className="border-r border-[#185c37] px-2 py-2">
                  Processor
                </th>
                <th className="border-r border-[#185c37] px-2 py-2">
                  Description of issue
                </th>
                <th className="border-r border-[#185c37] px-2 py-2">Company</th>
                <th className="border-r border-[#185c37] px-2 py-2">RMA #</th>
                <th className="border-r border-[#185c37] px-2 py-2">
                  RMA form
                </th>
                <th className="border-r border-[#185c37] px-2 py-2">
                  Repaired by
                </th>
                <th className="border-r border-[#185c37] px-2 py-2">Status</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepairs.map((row, index) => (
                <tr
                  key={row.id}
                  className="group bg-white text-zinc-950 even:bg-[#f8fbf8] hover:bg-[#eaf4ec] dark:bg-[#111827] dark:text-zinc-100 dark:even:bg-[#162032] dark:hover:bg-[#1d3b2b]"
                >
                  <td className="border-r border-t border-[#d9d9d9] bg-[#f3f2f1] px-2 py-1 text-center text-xs tabular-nums text-zinc-600 dark:border-zinc-700 dark:bg-[#1f2937] dark:text-zinc-300">
                    {index + 1}
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    <select
                      className={inputClassName("font-medium")}
                      value={row.model}
                      onChange={(event) =>
                        void updateRepair(row.id, { model: event.target.value })
                      }
                    >
                      {REPAIR_PRODUCT_OPTIONS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    <EditableTextCell
                      multiline
                      value={row.issueDescription}
                      onCommit={(value) =>
                        updateRepair(row.id, { issueDescription: value })
                      }
                    />
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    <div className="flex items-center">
                      <select
                        className={inputClassName("min-w-0 flex-1")}
                        value={row.company}
                        onChange={(event) =>
                          void updateRepair(row.id, {
                            company: event.target.value,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.name}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                      {row.company && customersByName.has(row.company) ? (
                        <Link
                          className="shrink-0 px-2 text-xs font-semibold text-[#217346] underline-offset-2 hover:underline dark:text-emerald-300"
                          href={`/customers/${encodeURIComponent(customersByName.get(row.company)?.id ?? "")}`}
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    <EditableTextCell
                      value={row.rmaNumber}
                      onCommit={(value) =>
                        updateRepair(row.id, { rmaNumber: value })
                      }
                    />
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    {row.rmaFormUrl ? (
                      <a
                        className="block px-2 py-1 text-xs font-semibold text-[#217346] underline-offset-2 hover:underline dark:text-emerald-300"
                        href={row.rmaFormUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open customer form
                      </a>
                    ) : (
                      <span className="block px-2 py-1 text-xs text-zinc-400 dark:text-zinc-500">
                        No customer form
                      </span>
                    )}
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    <select
                      className={inputClassName()}
                      value={row.repairedBy}
                      onChange={(event) =>
                        void updateRepair(row.id, {
                          repairedBy: event.target.value,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {employees.map((employee) => {
                        const label = employee.name || employee.email;
                        return (
                          <option key={employee.id} value={label}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="border-r border-t border-[#d9d9d9] align-middle dark:border-zinc-700">
                    <select
                      className={inputClassName()}
                      value={row.status}
                      onChange={(event) =>
                        void updateRepair(row.id, {
                          status: normalizeStatus(event.target.value),
                        })
                      }
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </td>
                  <td className="border-t border-[#d9d9d9] px-2 py-1 align-middle dark:border-zinc-700">
                    <button
                      type="button"
                      className="h-7 w-full border border-transparent text-xs font-semibold text-amber-700 hover:border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:hover:border-amber-800 dark:hover:bg-amber-950/30"
                      onClick={() => void archiveRepairRow(row.id)}
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function RepairsDashboard({
  repairs,
  error,
}: {
  repairs: RepairRow[];
  error: string;
}) {
  const openRepairs = repairs.filter((row) => row.status !== "DONE");
  const completedRepairs = repairs.filter((row) => row.status === "DONE");
  const companyGroups = groupRepairUnits(repairs, "company");
  const openEmployeeGroups = groupRepairUnits(openRepairs, "repairedBy");
  const repairedByGroups = groupRepairUnits(completedRepairs, "repairedBy");

  return (
    <section className="space-y-4" aria-label="Repair dashboard summary">
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Repair rows" value={repairs.length} />
        <Metric label="Processors" value={repairUnitTotal(repairs)} />
        <Metric label="Open processors" value={repairUnitTotal(openRepairs)} />
        <Metric
          label="Completed processors"
          value={repairUnitTotal(completedRepairs)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SummaryPanel
          title="Repairs by company"
          rows={companyGroups}
          empty="No companies assigned yet."
        />
        <SummaryPanel
          title="Open repairs by employee"
          rows={openEmployeeGroups}
          empty="No employee selected for open repairs yet."
        />
        <SummaryPanel
          title="Completed repairs by employee"
          rows={repairedByGroups}
          empty="No completed repairs yet."
        />
        <div className="panel-surface rounded-xl p-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Recent repair rows
          </h2>
          <ul className="mt-3 space-y-2">
            {[...repairs]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 8)
              .map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2 text-sm last:border-b-0 dark:border-zinc-800"
                >
                  <span>
                    {row.model || "Unnamed processor"}
                    <br />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {row.company || "No company"} -{" "}
                      {row.repairedBy || "Unassigned"}
                    </span>
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {statusLabels[row.status]}
                  </span>
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
      <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
    </dl>
  );
}

function SummaryPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  empty: string;
}) {
  return (
    <div className="panel-surface rounded-xl p-4">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 10).map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2 text-sm last:border-b-0 dark:border-zinc-800"
            >
              <span>{row.label}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
