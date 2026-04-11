import { auth } from "@/auth";
import { parseRequiredUploadNote } from "@/lib/attachment-upload-note";
import { writeAuditLog } from "@/lib/audit";
import { TABS_PROJECT_DETAIL } from "@/lib/employee-nav";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { removeProjectUploadFileIfPresent } from "@/lib/project-files";
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
  const denied = await guardEmployeeNavApi(session, TABS_PROJECT_DETAIL);
  if (denied) return denied;

  const { id: projectId, attachmentId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as { uploadNote?: string };
  const parsed = parseRequiredUploadNote(body.uploadNote);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const row = await prisma.projectAttachment.findFirst({
    where: { id: attachmentId, projectId },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const attachment = await prisma.projectAttachment.update({
    where: { id: row.id },
    data: { uploadNote: parsed.uploadNote },
    include: { uploader: uploaderSelect },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "ProjectAttachment",
    entityId: attachment.id,
    action: "UPDATE_NOTE",
    description: `Updated note for attachment "${row.fileName}" on project ${projectId}.`,
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
  const denied = await guardEmployeeNavApi(session, TABS_PROJECT_DETAIL);
  if (denied) return denied;

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
