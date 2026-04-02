import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  isSuperAdmin,
  parseAssignableRole,
  ROLE_SUPER_ADMIN,
} from "@/lib/roles";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { role?: string };
  const nextRole = parseAssignableRole(String(body.role ?? ""));
  if (!nextRole) {
    return NextResponse.json(
      { error: "role must be EMPLOYEE, ADMIN, or SUPER_ADMIN." },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, approvalStatus: true },
  });

  if (!target || target.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (target.role === ROLE_SUPER_ADMIN && nextRole !== ROLE_SUPER_ADMIN) {
    if (target.id !== session.user.id) {
      return NextResponse.json(
        { error: "Cannot remove super admin from another super admin." },
        { status: 403 },
      );
    }
    const otherSupers = await prisma.user.count({
      where: { role: ROLE_SUPER_ADMIN, id: { not: id } },
    });
    if (otherSupers === 0) {
      return NextResponse.json(
        { error: "Cannot remove the last super admin." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: nextRole },
    select: { id: true, name: true, email: true, role: true },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "User",
    entityId: updated.id,
    action: "ROLE_CHANGE",
    description: `Role for ${updated.email} set to ${updated.role}.`,
  });

  return NextResponse.json(updated);
}
