import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function WorkRecordsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("work-records");
  return children;
}
