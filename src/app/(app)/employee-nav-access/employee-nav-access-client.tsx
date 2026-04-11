"use client";

import {
  EMPLOYEE_NAV_TAB_IDS,
  type EmployeeNavTabId,
} from "@/lib/employee-nav";
import { useI18n } from "@/i18n/context";
import { useCallback, useMemo, useState } from "react";

type Props = {
  initialAccess: Record<EmployeeNavTabId, boolean>;
};

export function EmployeeNavAccessClient({ initialAccess }: Props) {
  const { t } = useI18n();
  const [access, setAccess] = useState<Record<EmployeeNavTabId, boolean>>(initialAccess);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const tabLabel = useCallback(
    (id: EmployeeNavTabId) => {
      const key = `employeeNavAccess.tabLabels.${id}`;
      const s = t(key);
      return s === key ? id : s;
    },
    [t],
  );

  const rows = useMemo(
    () => EMPLOYEE_NAV_TAB_IDS.map((id) => ({ id, label: tabLabel(id) })),
    [tabLabel],
  );

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings/employee-nav-access", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeNavAccess: access }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage(t("employeeNavAccess.couldNotSave"));
      return;
    }
    const data = (await res.json()) as { employeeNavAccess: Record<EmployeeNavTabId, boolean> };
    setAccess(data.employeeNavAccess);
    setMessage(t("employeeNavAccess.saved"));
  };

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("employeeNavAccess.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("employeeNavAccess.subtitle")}</p>
        <p className="mt-2 text-sm text-zinc-500">{t("employeeNavAccess.tabHelp")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <ul className="divide-y divide-zinc-100">
          {rows.map(({ id, label }) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="font-medium text-zinc-900">{label}</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300"
                  checked={access[id]}
                  onChange={(e) => setAccess((prev) => ({ ...prev, [id]: e.target.checked }))}
                />
                {t("employeeNavAccess.allowLabel")}
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
          >
            {saving ? t("employeeNavAccess.saving") : t("employeeNavAccess.save")}
          </button>
          {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
        </div>
      </section>
    </div>
  );
}
