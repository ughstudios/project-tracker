import { requireEmployeeNavAnyOf, TABS_CUSTOMER_DETAIL } from "@/lib/employee-nav";

export default async function CustomerDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavAnyOf(TABS_CUSTOMER_DETAIL);
  return children;
}
