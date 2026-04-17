import { requireEmployeeNavTab } from "@/lib/employee-nav";

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  await requireEmployeeNavTab("ai");
  return children;
}
