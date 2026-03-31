import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: issueId } = await params;
  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim() ?? "";
  if (!content) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, title: true, archivedAt: true },
  });
  if (!issue || issue.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const entry = await prisma.issueThreadEntry.create({
    data: {
      issueId,
      authorId: session.user.id,
      content,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
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
