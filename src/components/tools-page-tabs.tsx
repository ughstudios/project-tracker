"use client";

import { LedBandwidthTools } from "@/components/led-bandwidth-tools";
import { useI18n } from "@/i18n/context";
import { TOOLS_PAGE_TAB_IDS, type ToolsPageTabId } from "@/lib/tools-page-tabs";
import { useId, useState } from "react";

function tabLabelKey(id: ToolsPageTabId): string {
  return `tools.tabs.${id}`;
}

export function ToolsPageTabs() {
  const { t } = useI18n();
  const baseId = useId();
  const [active, setActive] = useState<ToolsPageTabId>("led-bandwidth");

  return (
    <div className="space-y-0">
      <div
        role="tablist"
        aria-label={t("tools.pageTabListAria")}
        className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700"
      >
        {TOOLS_PAGE_TAB_IDS.map((id) => {
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
                "relative -mb-px rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors",
                selected
                  ? "border border-b-0 border-zinc-200 bg-white text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  : "border border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              {t(tabLabelKey(id))}
            </button>
          );
        })}
      </div>

      <div className="pt-4">
        {TOOLS_PAGE_TAB_IDS.map((id) => {
          const panelId = `${baseId}-panel-${id}`;
          const tabId = `${baseId}-tab-${id}`;
          const hidden = active !== id;
          return (
            <div
              key={id}
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId}
              hidden={hidden}
            >
              {id === "led-bandwidth" ? <LedBandwidthTools /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
