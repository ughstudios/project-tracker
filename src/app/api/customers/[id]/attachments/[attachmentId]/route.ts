import { auth } from "@/auth";
import { parseRequiredUploadNote } from "@/lib/attachment-upload-note";
import { writeAuditLog } from "@/lib/audit";
import { removeCustomerUploadFileIfPresent } from "@/lib/customer-files";
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

  const { id: customerId, attachmentId } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const body = (await request.json()) as { uploadNote?: string };
  const parsed = parseRequiredUploadNote(body.uploadNote);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const row = await prisma.customerAttachment.findFirst({
    where: { id: attachmentId, customerId },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const attachment = await prisma.customerAttachment.update({
    where: { id: row.id },
    data: { uploadNote: parsed.uploadNote },
    include: { uploader: uploaderSelect },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "CustomerAttachment",
    entityId: attachment.id,
    action: "UPDATE_NOTE",
    description: `Updated note for attachment "${row.fileName}" on customer "${customer.name}".`,
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

  const { id: customerId, attachmentId } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, archivedAt: true },
  });
  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const row = await prisma.customerAttachment.findFirst({
    where: { id: attachmentId, customerId },
  });
  if (!row) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  await removeCustomerUploadFileIfPresent(row.fileUrl, customerId);
  await prisma.customerAttachment.delete({ where: { id: row.id } });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "CustomerAttachment",
    entityId: attachmentId,
    action: "DELETE",
    description: `Removed attachment ${row.fileName} from customer ${customerId}.`,
  });

  return NextResponse.json({ ok: true });
}
