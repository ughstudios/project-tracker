import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { autoArchiveExpiredDoneIssue } from "@/lib/issue-auto-archive";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const uploaderSelect = { select: { id: true, name: true, email: true } as const };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const { id: issueId } = await params;
  await autoArchiveExpiredDoneIssue(issueId);
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true },
  });
  if (!issue) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const parsedSize = parseInt(searchParams.get("pageSize") ?? "10", 10);
  const pageSize = Math.min(Math.max(Number.isFinite(parsedSize) ? parsedSize : 10, 1), 50);

  const total = await prisma.issueThreadEntry.count({ where: { issueId } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  let page = 1;
  if (rawPage === "last") {
    page = totalPages;
  } else {
    const p = parseInt(rawPage ?? "1", 10);
    page = Number.isFinite(p) && p >= 1 ? Math.min(p, totalPages) : 1;
  }

  const skip = (page - 1) * pageSize;

  const entries = await prisma.issueThreadEntry.findMany({
    where: { issueId },
    orderBy: { createdAt: "asc" },
    skip,
    take: pageSize,
    include: {
      author: uploaderSelect,
      attachments: {
        orderBy: { createdAt: "asc" },
        include: { uploader: uploaderSelect },
      },
    },
  });

  return NextResponse.json(
    { entries, total, page, pageSize, totalPages },
    { headers: { "Cache-Control": "private, no-store, must-revalidate" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const { id: issueId } = await params;
  await autoArchiveExpiredDoneIssue(issueId);
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, title: true, archivedAt: true },
  });
  if (!issue || issue.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error:
          "Multipart thread posts are not supported. Create the reply as JSON, then attach files using Vercel Blob client uploads.",
      },
      { status: 415 },
    );
  }

  const body = (await request.json()) as { content?: string; clientBlobAttachments?: boolean };
  const content = body.content?.trim() ?? "";
  if (!content && !body.clientBlobAttachments) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const entry = await prisma.issueThreadEntry.create({
    data: {
      issueId,
      authorId: session.user.id,
      content,
    },
    include: {
      author: uploaderSelect,
      attachments: { orderBy: { createdAt: "asc" }, include: { uploader: uploaderSelect } },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "IssueThreadEntry",
    entityId: entry.id,
    action: "CREATE",
    description: `Thread reply on issue "${issue.title}".`,
  });

  return NextResponse.json(entry, { status: 201 });
}
