import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  isSuperAdmin,
  parseAssignableRole,
  ROLE_SUPER_ADMIN,
  type AssignableRole,
} from "@/lib/roles";
import bcrypt from "bcryptjs";
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
  const body = (await request.json()) as {
    role?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const rawRole =
    body.role !== undefined ? String(body.role).trim() : "";
  let nextRole: AssignableRole | undefined;
  if (!rawRole) {
    nextRole = undefined;
  } else {
    const parsed = parseAssignableRole(rawRole);
    if (!parsed) {
      return NextResponse.json(
        { error: "role must be EMPLOYEE, ADMIN, or SUPER_ADMIN." },
        { status: 400 },
      );
    }
    nextRole = parsed;
  }

  const newPasswordRaw =
    body.newPassword !== undefined ? String(body.newPassword) : "";
  const confirmRaw =
    body.confirmPassword !== undefined ? String(body.confirmPassword) : "";
  const wantsPasswordReset = newPasswordRaw.length > 0;

  if (!nextRole && !wantsPasswordReset) {
    return NextResponse.json(
      { error: "Provide a role change and/or a new password." },
      { status: 400 },
    );
  }

  if (wantsPasswordReset) {
    if (newPasswordRaw.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 },
      );
    }
    if (newPasswordRaw !== confirmRaw) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 },
      );
    }
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, approvalStatus: true },
  });

  if (!target || target.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (nextRole !== undefined) {
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
  }

  const data: { role?: string; passwordHash?: string } = {};
  if (nextRole !== undefined) data.role = nextRole;
  if (wantsPasswordReset) {
    data.passwordHash = await bcrypt.hash(newPasswordRaw, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true },
  });

  if (nextRole !== undefined) {
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "User",
      entityId: updated.id,
      action: "ROLE_CHANGE",
      description: `Role for ${updated.email} set to ${updated.role}.`,
    });
  }

  if (wantsPasswordReset) {
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "User",
      entityId: updated.id,
      action: "PASSWORD_RESET",
      description: `Password reset for ${updated.email} by super admin.`,
    });
  }

  return NextResponse.json(updated);
}
