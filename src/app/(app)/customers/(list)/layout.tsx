import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function CustomersListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavTab("customers");
  return children;
}
