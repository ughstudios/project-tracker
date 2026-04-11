import { requireEmployeeNavAnyOf } from "@/lib/employee-nav";
import { TABS_PROJECT_DETAIL } from "@/lib/employee-nav-shared";

export default async function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavAnyOf(TABS_PROJECT_DETAIL);
  return children;
}
