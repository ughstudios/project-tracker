import { auth } from "@/auth";
import {
  getEmployeeNavAccessRow,
  mergeEmployeeNavAccess,
  parseEmployeeNavAccessJson,
} from "@/lib/employee-nav";
import { isPrivilegedAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { EmployeeNavAccessClient } from "./employee-nav-access-client";

export default async function EmployeeNavAccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isPrivilegedAdmin(session.user.role)) redirect("/dashboard");

  const row = await getEmployeeNavAccessRow();
  const partial = parseEmployeeNavAccessJson(row.employeeNavAccess);
  const merged = mergeEmployeeNavAccess(partial);

  return <EmployeeNavAccessClient initialAccess={merged} settingsDbOk={row.ok} />;
}
