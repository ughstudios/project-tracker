import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  contentTypeForUpload,
  vercelMultipartPayloadTooLargeResponse,
  vercelUploadsNotReadyResponse,
  writeUploadedFile,
} from "@/lib/file-storage";
import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  maxIssueUploadBytesForRuntime,
  storedFileName,
} from "@/lib/issue-files";
import { prisma } from "@/lib/prisma";
import path from "node:path";
import { NextResponse } from "next/server";

const uploaderSelect = { select: { id: true, name: true, email: true } as const };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = vercelUploadsNotReadyResponse();
  if (blocked) return blocked;

  const { id: customerId } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if ((key === "file" || key === "files") && value instanceof File && value.size > 0) {
      files.push(value);
    }
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return NextResponse.json(
      { error: `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per upload.` },
      { status: 400 },
    );
  }
  const maxBytes = maxIssueUploadBytesForRuntime();
  for (const f of files) {
    if (f.size > maxBytes) {
      return NextResponse.json({ error: "One or more files are too large." }, { status: 400 });
    }
  }
  const tooLarge = vercelMultipartPayloadTooLargeResponse(files);
  if (tooLarge) return tooLarge;

  const uploadDir = path.join(process.cwd(), "public", "uploads", "customers", customerId);

  const created = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storedName = storedFileName(file.name);
    const ext = path.extname(file.name).toLowerCase();
    const { fileUrl } = await writeUploadedFile({
      buffer,
      blobPathname: `customers/${customerId}/${storedName}`,
      localDir: uploadDir,
      publicUrlDir: `/uploads/customers/${customerId}`,
      fileName: storedName,
      contentType: contentTypeForUpload(file),
    });
    const attachment = await prisma.customerAttachment.create({
      data: {
        customerId,
        uploaderId: session.user.id,
        fileName: file.name,
        fileUrl,
        fileType: ext ? ext.slice(1) : "bin",
        fileSize: file.size,
      },
      include: { uploader: uploaderSelect },
    });
    created.push(attachment);
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "CustomerAttachment",
      entityId: attachment.id,
      action: "UPLOAD",
      description: `${file.name} attached to customer "${customer.name}".`,
    });
  }

  return NextResponse.json({ attachments: created }, { status: 201 });
}
