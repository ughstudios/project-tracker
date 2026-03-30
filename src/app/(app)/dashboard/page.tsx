import { IssueDashboard } from "@/components/issue-dashboard";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Track issues by status and assign them to employees.
        </p>
      </header>
      <IssueDashboard />
    </div>
  );
}

