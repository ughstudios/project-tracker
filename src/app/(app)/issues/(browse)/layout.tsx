import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function IssuesBrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("issues");
  return children;
}
