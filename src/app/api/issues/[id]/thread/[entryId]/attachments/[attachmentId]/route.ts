import { auth } from "@/auth";
import { removeUploadFileIfPresent } from "@/lib/issue-files";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; entryId: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: issueId, entryId, attachmentId } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, archivedAt: true },
  });
  if (!issue || issue.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const row = await prisma.issueThreadAttachment.findFirst({
    where: {
      id: attachmentId,
      threadEntryId: entryId,
      threadEntry: { issueId },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  await removeUploadFileIfPresent(row.fileUrl, issueId);
  await prisma.issueThreadAttachment.delete({ where: { id: row.id } });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "IssueThreadAttachment",
    entityId: attachmentId,
    action: "DELETE",
    description: `Removed thread attachment ${row.fileName} from issue ${issueId}.`,
  });

  return NextResponse.json({ ok: true });
}
