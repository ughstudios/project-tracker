import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function RepairsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("issues");
  return children;
}
