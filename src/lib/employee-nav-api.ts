import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { isPrivilegedAdmin } from "@/lib/roles";
import { getEmployeeNavAccessMap } from "@/lib/employee-nav";
import {
  type EmployeeNavTabId,
  employeeNavAllowsAny,
} from "@/lib/employee-nav-shared";

/**
 * For employees: allow the request only if at least one of `tabs` is not disabled.
 * Admins always pass. Returns a NextResponse to return early, or null to continue.
 */
export async function guardEmployeeNavApi(
  session: Session | null,
  tabs: readonly EmployeeNavTabId[],
): Promise<NextResponse | null> {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isPrivilegedAdmin(session.user.role)) return null;
  const map = await getEmployeeNavAccessMap();
  if (employeeNavAllowsAny(map, tabs)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
