"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; name: string; _count?: { projects: number } };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/customers");
    if (res.ok) setCustomers(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await load();
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
      alert(`Could not create customer. (HTTP ${res.status})${detail}`);
      return;
    }
    setName("");
    await load();
  };

  const archiveCustomer = async (id: string, displayName: string) => {
    const confirmed = confirm(`Archive customer "${displayName}"?`);
    if (!confirmed) return;
    setArchivingId(id);
    const res = await fetch(`/api/customers/${id}`, { method: "PATCH" });
    setArchivingId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "Could not archive customer.");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Customers</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Create customers, then assign projects to them.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Create Customer</h2>
        <form onSubmit={create} className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            className="input flex-1"
            placeholder="Customer name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-500"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Customer List</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-600">Loading...</p>
        ) : customers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No customers yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <th className="border border-zinc-200 px-2 py-2">Customer</th>
                  <th className="border border-zinc-200 px-2 py-2">Projects</th>
                  <th className="border border-zinc-200 px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="odd:bg-white even:bg-zinc-50/50">
                    <td className="border border-zinc-200 px-2 py-2 font-medium">
                      {c.name}
                    </td>
                    <td className="border border-zinc-200 px-2 py-2 text-zinc-700">
                      {c._count?.projects ?? 0}
                    </td>
                    <td className="border border-zinc-200 px-2 py-2">
                      <button
                        type="button"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                        onClick={() => archiveCustomer(c.id, c.name)}
                        disabled={archivingId === c.id}
                      >
                        {archivingId === c.id ? "Archiving..." : "Archive"}
                      </button>
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

