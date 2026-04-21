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
    select: {
      submissionId: true,
      status: true,
      archivedAt: true,
      kind: true,
      closedAt: true,
    },
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
    assigneeId?: string | null;
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

  type PatchResponse = {
    ok: true;
    status?: string;
    closedAt?: string | null;
    assignee?: { id: string; name: string; email: string } | null;
  };
  const out: PatchResponse = { ok: true };
  let changed = false;

  const data: { status?: string; closedAt?: Date | null; assigneeId?: string | null } = {};
  let nextStatus: string | undefined;
  let statusAuditDescription: string | undefined;

  if (body.status !== undefined) {
    changed = true;
    nextStatus = String(body.status).trim().toUpperCase();
    if (!ALLOWED_STATUS.has(nextStatus)) {
      return NextResponse.json(
        { error: "Status must be PENDING, IN_PROGRESS, or CLOSED." },
        { status: 400 },
      );
    }
    const becameClosed = nextStatus === "CLOSED" && existing.status !== "CLOSED";
    const reopening = nextStatus !== "CLOSED" && existing.status === "CLOSED";
    data.status = nextStatus;
    if (becameClosed) data.closedAt = new Date();
    else if (reopening) data.closedAt = null;
    const effectiveClosedAt =
      nextStatus === "CLOSED"
        ? becameClosed
          ? data.closedAt ?? null
          : existing.closedAt
        : null;
    out.status = nextStatus;
    out.closedAt = effectiveClosedAt?.toISOString() ?? null;
    statusAuditDescription = `Status set to ${nextStatus} for ${existing.kind} request ${submissionId.slice(0, 8)}.`;
  }

  let assigneeForResponse: { id: string; name: string; email: string } | null | undefined;
  let assigneeAuditDescription: string | undefined;

  if ("assigneeId" in body) {
    changed = true;
    const raw = body.assigneeId;
    let nextAssigneeId: string | null;
    if (raw === null || raw === undefined || raw === "") {
      nextAssigneeId = null;
    } else if (typeof raw === "string") {
      const t = raw.trim();
      nextAssigneeId = t.length ? t : null;
    } else {
      return NextResponse.json({ error: "Invalid assigneeId." }, { status: 400 });
    }

    if (nextAssigneeId) {
      const user = await prisma.user.findFirst({
        where: { id: nextAssigneeId, approvalStatus: "APPROVED" },
        select: { id: true, name: true, email: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "Assignee must be an approved employee account." },
          { status: 400 },
        );
      }
      data.assigneeId = user.id;
      assigneeForResponse = user;
      assigneeAuditDescription = `Assigned ${existing.kind} request ${submissionId.slice(0, 8)} to ${user.email}.`;
    } else {
      data.assigneeId = null;
      assigneeForResponse = null;
      assigneeAuditDescription = `Cleared assignee for ${existing.kind} request ${submissionId.slice(0, 8)}.`;
    }
    out.assignee = assigneeForResponse;
  }

  if (!changed) {
    return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  }

  await prisma.publicCustomerRequest.update({
    where: { submissionId },
    data,
  });

  if (statusAuditDescription) {
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "PublicCustomerRequest",
      entityId: submissionId,
      action: "STATUS",
      description: statusAuditDescription,
    });
  }
  if (assigneeAuditDescription) {
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "PublicCustomerRequest",
      entityId: submissionId,
      action: "ASSIGN",
      description: assigneeAuditDescription,
    });
  }

  return NextResponse.json(out);
}
