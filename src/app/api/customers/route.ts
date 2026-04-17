import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_CUSTOMER_DETAIL } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_CUSTOMER_DETAIL);
  if (denied) return denied;

  const customers = await prisma.customer.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          projects: { where: { archivedAt: null } },
          contacts: true,
        },
      },
    },
  });

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_CUSTOMER_DETAIL);
  if (denied) return denied;

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }

  const customer = await prisma.customer.upsert({
    where: { name },
    update: { archivedAt: null },
    create: { name },
    include: {
      _count: {
        select: {
          projects: { where: { archivedAt: null } },
          contacts: true,
        },
      },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Customer",
    entityId: customer.id,
    action: "UPSERT",
    description: `Customer "${customer.name}" created or reused.`,
  });

  return NextResponse.json(customer, { status: 201 });
}

