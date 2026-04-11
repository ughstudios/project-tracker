import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function KanbanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("kanban");
  return children;
}
