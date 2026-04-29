import { auth } from "@/auth";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { createRepair, listRepairs } from "@/lib/repair-store";
import { makeBlankRepair } from "@/lib/repairs";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const repairs = await listRepairs();
  return NextResponse.json({ repairs }, { headers: { "Cache-Control": "private, no-store, must-revalidate" } });
}

export async function POST() {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const repair = await createRepair(makeBlankRepair());
  return NextResponse.json({ repair }, { status: 201 });
}
