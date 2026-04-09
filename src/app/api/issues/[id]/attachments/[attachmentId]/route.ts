import { auth } from "@/auth";
import { parseRequiredUploadNote } from "@/lib/attachment-upload-note";
import { writeAuditLog } from "@/lib/audit";
import { removeUploadFileIfPresent } from "@/lib/issue-files";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const uploaderSelect = { select: { id: true, name: true, email: true } as const };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: issueId, attachmentId } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, archivedAt: true, title: true },
  });
  if (!issue || issue.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const body = (await request.json()) as { uploadNote?: string };
  const parsed = parseRequiredUploadNote(body.uploadNote);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const row = await prisma.issueAttachment.findFirst({
    where: { id: attachmentId, issueId },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const attachment = await prisma.issueAttachment.update({
    where: { id: row.id },
    data: { uploadNote: parsed.uploadNote },
    include: { uploader: uploaderSelect },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "IssueAttachment",
    entityId: attachment.id,
    action: "UPDATE_NOTE",
    description: `Updated note for attachment "${row.fileName}" on issue "${issue.title}".`,
  });

  return NextResponse.json({ attachment });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: issueId, attachmentId } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, archivedAt: true },
  });
  if (!issue || issue.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const row = await prisma.issueAttachment.findFirst({
    where: { id: attachmentId, issueId },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  await removeUploadFileIfPresent(row.fileUrl, issueId);
  await prisma.issueAttachment.delete({ where: { id: row.id } });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "IssueAttachment",
    entityId: attachmentId,
    action: "DELETE",
    description: `Removed attachment ${row.fileName} from issue ${issueId}.`,
  });

  return NextResponse.json({ ok: true });
}
