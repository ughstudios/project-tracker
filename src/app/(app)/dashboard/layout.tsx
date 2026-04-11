import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("dashboard");
  return children;
}
