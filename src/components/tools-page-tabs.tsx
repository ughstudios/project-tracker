"use client";

import { LedBandwidthTools } from "@/components/led-bandwidth-tools";
import { useI18n } from "@/i18n/context";
import { TOOLS_PAGE_TAB_IDS, type ToolsPageTabId } from "@/lib/tools-page-tabs";
import { useId, useState } from "react";

function tabLabelKey(id: ToolsPageTabId): string {
  return `tools.tabs.${id}`;
}

function renderToolPanel(id: ToolsPageTabId) {
  switch (id) {
    case "led-bandwidth":
      return <LedBandwidthTools />;
    default:
      return null;
  }
}

export function ToolsPageTabs() {
  const { t } = useI18n();
  const baseId = useId();
  const [active, setActive] = useState<ToolsPageTabId>(TOOLS_PAGE_TAB_IDS[0]);
  const showTabBar = TOOLS_PAGE_TAB_IDS.length > 1;

  if (!showTabBar) {
    const only = TOOLS_PAGE_TAB_IDS[0];
    return <div className="min-w-0">{renderToolPanel(only)}</div>;
  }

  return (
    <div className="panel-surface min-w-0 overflow-hidden rounded-xl">
      <div
        role="tablist"
        aria-label={t("tools.pageTabListAria")}
        className="flex flex-wrap gap-1 rounded-t-xl bg-zinc-100/90 p-1.5 dark:bg-zinc-950/60 sm:p-2"
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
                "min-h-10 flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4",
                selected
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              {t(tabLabelKey(id))}
            </button>
          );
        })}
      </div>
      <div className="border-t border-zinc-200/80 p-4 dark:border-zinc-700/80 sm:p-5">
        {TOOLS_PAGE_TAB_IDS.map((id) => {
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
            >
              {isActive ? renderToolPanel(id) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
