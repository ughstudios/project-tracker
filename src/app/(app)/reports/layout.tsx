import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("reports");
  return children;
}
