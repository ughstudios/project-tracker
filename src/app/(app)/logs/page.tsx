"use client";

import { useEffect, useState } from "react";

type LogItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  actor?: { id: string; name: string | null; email: string | null } | null;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await fetch("/api/logs");
      if (res.ok) setLogs(await res.json());
      setLoading(false);
    };
    void run();
  }, []);

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Logs</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Audit trail of edits, uploads, and updates with timestamps and actor.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-zinc-600">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-zinc-600">No logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <th className="border border-zinc-200 px-2 py-2">When</th>
                  <th className="border border-zinc-200 px-2 py-2">Actor</th>
                  <th className="border border-zinc-200 px-2 py-2">Action</th>
                  <th className="border border-zinc-200 px-2 py-2">Entity</th>
                  <th className="border border-zinc-200 px-2 py-2">Details</th>
                  <th className="border border-zinc-200 px-2 py-2">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="odd:bg-white even:bg-zinc-50/50">
                    <td className="border border-zinc-200 px-2 py-2">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="border border-zinc-200 px-2 py-2">
                      {log.actor?.name ?? log.actor?.email ?? "Unknown"}
                    </td>
                    <td className="border border-zinc-200 px-2 py-2">{log.action}</td>
                    <td className="border border-zinc-200 px-2 py-2">
                      {log.entityType} ({log.entityId})
                    </td>
                    <td className="border border-zinc-200 px-2 py-2">{log.description}</td>
                    <td className="border border-zinc-200 px-2 py-2">
                      {new Date(log.updatedAt).toLocaleString()}
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

