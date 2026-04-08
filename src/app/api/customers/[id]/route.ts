import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      attachments: { orderBy: { createdAt: "desc" } },
      _count: { select: { projects: { where: { archivedAt: null } } } },
    },
  });

  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json(customer, {
    headers: { "Cache-Control": "private, no-store, must-revalidate" },
  });
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivilegedAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const customer = await prisma.customer.update({
    where: { id },
    data: { archivedAt: new Date() },
    select: { id: true, name: true },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Customer",
    entityId: customer.id,
    action: "ARCHIVE",
    description: `Customer "${customer.name}" archived.`,
  });

  return NextResponse.json({ ok: true });
}
