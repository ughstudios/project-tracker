import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_PENDING_CUSTOMER_REQUESTS } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { autoArchiveClosedPublicCustomerRequests } from "@/lib/public-customer-request-auto-archive";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_STATUS = new Set(["PENDING", "IN_PROGRESS", "CLOSED"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_PENDING_CUSTOMER_REQUESTS);
  if (denied) return denied;

  await autoArchiveClosedPublicCustomerRequests();

  const { submissionId } = await params;
  if (!submissionId?.trim()) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  const existing = await prisma.publicCustomerRequest.findUnique({
    where: { submissionId },
    select: { submissionId: true, status: true, archivedAt: true, kind: true, closedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json({ error: "This request is archived." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    archiveNow?: boolean;
  };

  if (body.archiveNow === true) {
    await prisma.publicCustomerRequest.update({
      where: { submissionId },
      data: { archivedAt: new Date() },
    });
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "PublicCustomerRequest",
      entityId: submissionId,
      action: "ARCHIVE",
      description: `Archived ${existing.kind} public request ${submissionId.slice(0, 8)}.`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.status !== undefined) {
    const next = String(body.status).trim().toUpperCase();
    if (!ALLOWED_STATUS.has(next)) {
      return NextResponse.json(
        { error: "Status must be PENDING, IN_PROGRESS, or CLOSED." },
        { status: 400 },
      );
    }
    const becameClosed = next === "CLOSED" && existing.status !== "CLOSED";
    const reopening = next !== "CLOSED" && existing.status === "CLOSED";
    const updateData: { status: string; closedAt?: Date | null } = { status: next };
    if (becameClosed) updateData.closedAt = new Date();
    else if (reopening) updateData.closedAt = null;
    await prisma.publicCustomerRequest.update({
      where: { submissionId },
      data: updateData,
    });
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "PublicCustomerRequest",
      entityId: submissionId,
      action: "STATUS",
      description: `Status set to ${next} for ${existing.kind} request ${submissionId.slice(0, 8)}.`,
    });
    const effectiveClosedAt =
      next === "CLOSED" ? (becameClosed ? updateData.closedAt ?? null : existing.closedAt) : null;
    return NextResponse.json({
      ok: true,
      status: next,
      closedAt: effectiveClosedAt?.toISOString() ?? null,
    });
  }

  return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
}
