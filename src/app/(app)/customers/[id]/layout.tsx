import { requireEmployeeNavAnyOf } from "@/lib/employee-nav";
import { TABS_CUSTOMER_DETAIL } from "@/lib/employee-nav-shared";

export default async function CustomerDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireEmployeeNavAnyOf(TABS_CUSTOMER_DETAIL);
  return children;
}
