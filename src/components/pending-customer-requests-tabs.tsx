"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

export type PendingCustomerRequestsTabId = "calibration" | "processor-rma";

const TAB_IDS: PendingCustomerRequestsTabId[] = ["calibration", "processor-rma"];

function tabButtonLabel(id: PendingCustomerRequestsTabId, count: number): string {
  const base = id === "calibration" ? "Calibration" : "Processor RMA";
  return count > 0 ? `${base} (${count})` : base;
}

export function PendingCustomerRequestsTabs({
  defaultTab = "calibration",
  calibrationCount,
  rmaCount,
  calibrationPanel,
  rmaPanel,
}: {
  defaultTab?: PendingCustomerRequestsTabId;
  calibrationCount: number;
  rmaCount: number;
  calibrationPanel: ReactNode;
  rmaPanel: ReactNode;
}) {
  const baseId = useId();
  const [active, setActive] = useState<PendingCustomerRequestsTabId>(defaultTab);

  const panels: Record<PendingCustomerRequestsTabId, ReactNode> = {
    calibration: calibrationPanel,
    "processor-rma": rmaPanel,
  };

  const counts: Record<PendingCustomerRequestsTabId, number> = {
    calibration: calibrationCount,
    "processor-rma": rmaCount,
  };

  return (
    <div className="panel-surface min-w-0 overflow-hidden rounded-xl">
      <div
        role="tablist"
        aria-label="Pending customer request types"
        className="flex flex-wrap gap-1 rounded-t-xl bg-zinc-100/90 p-1.5 dark:bg-zinc-950/60 sm:p-2"
      >
        {TAB_IDS.map((id) => {
          const selected = active === id;
          const panelId = `${baseId}-panel-${id}`;
          const tabId = `${baseId}-tab-${id}`;
          return (
            <button
              key={id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(id)}
              className={[
                "min-h-10 flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4",
                selected
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              {tabButtonLabel(id, counts[id])}
            </button>
          );
        })}
      </div>
      <div className="border-t border-zinc-200/80 p-4 dark:border-zinc-700/80 sm:p-5">
        {TAB_IDS.map((id) => {
          const panelId = `${baseId}-panel-${id}`;
          const tabId = `${baseId}-tab-${id}`;
          const isActive = active === id;
          return (
            <div
              key={id}
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId}
              hidden={!isActive}
              className="min-w-0"
            >
              {isActive ? panels[id] : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
