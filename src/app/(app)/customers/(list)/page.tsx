"use client";

import { useI18n } from "@/i18n/context";
import { isPrivilegedAdmin } from "@/lib/roles";
import Link from "next/link";
import { useEffect, useState } from "react";

type Customer = { id: string; name: string; _count?: { projects: number } };

export default function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/customers");
    if (res.ok) setCustomers(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await load();
      const sessionRes = await fetch("/api/auth/session");
      if (sessionRes.ok) {
        const session = (await sessionRes.json()) as { user?: { role?: string } };
        setIsAdmin(isPrivilegedAdmin(session.user?.role));
      }
    };
    void run();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      let detail = "";
      try {
        const data = (await res.json()) as { error?: string };
        detail = data?.error ? `\n\n${data.error}` : "";
      } catch {
        // ignore
      }
      alert(t("customers.couldNotCreate", { status: String(res.status), detail }));
      return;
    }
    setName("");
    await load();
  };

  const archiveCustomer = async (id: string, displayName: string) => {
    const confirmed = confirm(t("customers.archiveConfirm", { name: displayName }));
    if (!confirmed) return;
    setArchivingId(id);
    const res = await fetch(`/api/customers/${id}`, { method: "PATCH" });
    setArchivingId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("customers.couldNotArchive"));
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("customers.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("customers.subtitle")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("customers.createSection")}</h2>
        <form onSubmit={create} className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            className="input flex-1"
            placeholder={t("customers.namePlaceholder")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:bg-zinc-50 dark:bg-zinc-9500"
          >
            {saving ? t("common.creating") : t("common.create")}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("customers.listSection")}</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("customers.loading")}</p>
        ) : customers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("customers.none")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.customer")}</th>
                  <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.projects")}</th>
                  {isAdmin ? (
                    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">{t("common.actions")}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="odd:bg-white dark:bg-zinc-900 dark:odd:bg-zinc-900 even:bg-zinc-50 dark:bg-zinc-950/50 dark:even:bg-zinc-800/40">
                    <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2 font-medium">
                      <Link
                        href={`/customers/${encodeURIComponent(c.id)}`}
                        className="link-accent underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2 text-zinc-700 dark:text-zinc-300">
                      <Link
                        href={`/projects?customer=${encodeURIComponent(c.id)}`}
                        className="link-accent tabular-nums font-medium underline"
                        title={t("customers.viewProjectsFor", { name: c.name })}
                      >
                        {c._count?.projects ?? 0}
                      </Link>
                    </td>
                    {isAdmin ? (
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-2">
                        <button
                          type="button"
                          className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800"
                          onClick={() => archiveCustomer(c.id, c.name)}
                          disabled={archivingId === c.id}
                        >
                          {archivingId === c.id ? t("common.archiving") : t("common.archive")}
                        </button>
                      </td>
                    ) : null}
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
