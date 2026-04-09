"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { isPrivilegedAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function approveRegistration(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isPrivilegedAdmin(session.user.role)) {
    return;
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const approvedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
    },
    select: { id: true, email: true },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "User",
    entityId: approvedUser.id,
    action: "APPROVE",
    description: `Approved registration for ${approvedUser.email}.`,
  });

  revalidatePath("/pending-registrations");
}

export async function rejectAndDeleteRegistration(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isPrivilegedAdmin(session.user.role)) {
    return;
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { approvalStatus: true, email: true },
  });
  if (!target || target.approvalStatus !== "PENDING") return;

  const deleted = await prisma.user.deleteMany({
    where: { id: userId, approvalStatus: "PENDING" },
  });
  if (deleted.count === 0) return;

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "User",
    entityId: userId,
    action: "REJECT_DELETE",
    description: `Rejected and deleted pending registration for ${target.email}.`,
  });

  revalidatePath("/pending-registrations");
}
