import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { removeProjectUploadFileIfPresent } from "@/lib/project-files";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

  const { id: projectId, attachmentId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const row = await prisma.projectAttachment.findFirst({
    where: { id: attachmentId, projectId },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  await removeProjectUploadFileIfPresent(row.fileUrl, projectId);
  await prisma.projectAttachment.delete({ where: { id: row.id } });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "ProjectAttachment",
    entityId: attachmentId,
    action: "DELETE",
    description: `Removed attachment ${row.fileName} from project ${projectId}.`,
  });

  return NextResponse.json({ ok: true });
}
