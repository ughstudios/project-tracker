import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  EMPLOYEE_NAV_TAB_IDS,
  getEmployeeNavAccessRow,
  mergeEmployeeNavAccess,
  parseEmployeeNavAccessJson,
  type EmployeeNavTabId,
} from "@/lib/employee-nav";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivilegedAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const row = await getEmployeeNavAccessRow();
  const partial = parseEmployeeNavAccessJson(row.employeeNavAccess);
  return NextResponse.json({
    employeeNavAccess: mergeEmployeeNavAccess(partial),
    settingsDbOk: row.ok,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivilegedAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!isRecord(body) || !isRecord(body.employeeNavAccess)) {
    return NextResponse.json({ error: "employeeNavAccess object required." }, { status: 400 });
  }

  const incoming = body.employeeNavAccess;
  const stored: Record<string, boolean> = {};
  for (const id of EMPLOYEE_NAV_TAB_IDS) {
    if (id in incoming) {
      stored[id] = Boolean(incoming[id]);
    }
  }

  const row = await getEmployeeNavAccessRow();
  if (!row.ok) {
    return NextResponse.json(
      {
        error:
          "App settings database table is missing. On the server, run: npx prisma migrate deploy",
      },
      { status: 503 },
    );
  }
  const prevPartial = parseEmployeeNavAccessJson(row.employeeNavAccess);
  const nextPartial: Partial<Record<EmployeeNavTabId, boolean>> = { ...prevPartial };
  for (const id of EMPLOYEE_NAV_TAB_IDS) {
    if (id in stored) nextPartial[id] = stored[id];
  }

  try {
    await prisma.appSettings.update({
      where: { id: row.id },
      data: { employeeNavAccess: nextPartial as object },
    });
  } catch (err) {
    console.error("[employee-nav] Failed to update AppSettings.", err);
    return NextResponse.json(
      {
        error:
          "Could not save settings. Ensure migrations are applied (npx prisma migrate deploy).",
      },
      { status: 503 },
    );
  }

  const merged = mergeEmployeeNavAccess(nextPartial);
  const disabled = EMPLOYEE_NAV_TAB_IDS.filter((id) => merged[id] === false);
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "AppSettings",
    entityId: row.id,
    action: "UPDATE_EMPLOYEE_NAV",
    description:
      disabled.length === 0
        ? "Employee nav access: all main areas enabled."
        : `Employee nav disabled for: ${disabled.join(", ")}.`,
  });

  return NextResponse.json({ employeeNavAccess: merged });
}
