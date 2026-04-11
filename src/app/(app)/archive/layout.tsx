import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("archive");
  return children;
}
