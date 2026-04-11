import { requireEmployeeNavAnyOf, TABS_PROJECT_DETAIL } from "@/lib/employee-nav";

export default async function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavAnyOf(TABS_PROJECT_DETAIL);
  return children;
}
