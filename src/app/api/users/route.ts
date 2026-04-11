import { auth } from "@/auth";
import { TABS_USERS_LIST } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_USERS_LIST);
  if (denied) return denied;

  const users = await prisma.user.findMany({
    where: { approvalStatus: "APPROVED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return NextResponse.json(users);
}
