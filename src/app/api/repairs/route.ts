import { auth } from "@/auth";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { createRepair, listRepairs } from "@/lib/repair-store";
import { makeBlankRepair } from "@/lib/repairs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const repairs = await listRepairs();
  const customers = await prisma.customer.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ repairs, customers }, { headers: { "Cache-Control": "private, no-store, must-revalidate" } });
}

export async function POST() {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const repair = await createRepair(makeBlankRepair()).catch((error) => {
    if (error instanceof Error) return error;
    return new Error("Could not add repair.");
  });
  if (repair instanceof Error) {
    return NextResponse.json({ error: repair.message }, { status: 400 });
  }
  return NextResponse.json({ repair }, { status: 201 });
}
