import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("logs");
  return children;
}
