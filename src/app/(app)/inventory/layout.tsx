import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("inventory");
  return children;
}
