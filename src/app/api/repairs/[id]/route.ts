import { auth } from "@/auth";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { deleteRepair, updateRepair } from "@/lib/repair-store";
import type { RepairRow } from "@/lib/repairs";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const { id } = await params;
  const patch = (await request.json()) as Partial<RepairRow>;
  const repair = await updateRepair(id, patch);
  if (!repair) {
    return NextResponse.json({ error: "Repair not found." }, { status: 404 });
  }
  return NextResponse.json({ repair });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const { id } = await params;
  await deleteRepair(id);
  return NextResponse.json({ ok: true });
}
