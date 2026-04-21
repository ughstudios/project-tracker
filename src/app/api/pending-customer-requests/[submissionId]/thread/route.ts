import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_PENDING_CUSTOMER_REQUESTS } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { autoArchiveClosedPublicCustomerRequests } from "@/lib/public-customer-request-auto-archive";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const authorSelect = { select: { id: true, name: true, email: true } as const };

export async function GET(
  _request: Request,
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
  const request = await prisma.publicCustomerRequest.findUnique({
    where: { submissionId },
    select: { archivedAt: true },
  });
  if (!request) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const entries = await prisma.publicCustomerRequestThreadEntry.findMany({
    where: { submissionId },
    orderBy: { createdAt: "asc" },
    include: { author: authorSelect },
  });

  return NextResponse.json({ entries }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(
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
  const row = await prisma.publicCustomerRequest.findUnique({
    where: { submissionId },
    select: { archivedAt: true, kind: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (row.archivedAt) {
    return NextResponse.json({ error: "Archived requests are read-only." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { content?: string };
  const content = body.content?.trim() ?? "";
  if (!content) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const entry = await prisma.publicCustomerRequestThreadEntry.create({
    data: {
      submissionId,
      authorId: session.user.id,
      content,
    },
    include: { author: authorSelect },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "PublicCustomerRequest",
    entityId: submissionId,
    action: "THREAD_REPLY",
    description: `Thread reply on ${row.kind} request ${submissionId.slice(0, 8)}.`,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
