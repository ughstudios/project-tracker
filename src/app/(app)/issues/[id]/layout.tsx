import { requireEmployeeNavAnyOf } from "@/lib/employee-nav";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";

export default async function IssueDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavAnyOf(TABS_ISSUE_DATA);
  return children;
}
