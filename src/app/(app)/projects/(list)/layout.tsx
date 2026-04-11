import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function ProjectsListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("projects");
  return children;
}
