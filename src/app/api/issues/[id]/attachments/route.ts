import { auth } from "@/auth";
import {
  ISSUE_UPLOAD_MAX_BYTES,
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  storedFileName,
} from "@/lib/issue-files";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
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

  const { id: issueId } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, title: true, archivedAt: true },
  });
  if (!issue || issue.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
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
  for (const f of files) {
    if (f.size > ISSUE_UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: "One or more files are too large." }, { status: 400 });
    }
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "issues", issueId);
  await fs.mkdir(uploadDir, { recursive: true });

  const created = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storedName = storedFileName(file.name);
    const fullPath = path.join(uploadDir, storedName);
    await fs.writeFile(fullPath, buffer);
    const ext = path.extname(file.name).toLowerCase();
    const fileUrl = `/uploads/issues/${issueId}/${storedName}`;
    const attachment = await prisma.issueAttachment.create({
      data: {
        issueId,
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
      entityType: "IssueAttachment",
      entityId: attachment.id,
      action: "UPLOAD",
      description: `${file.name} attached to issue "${issue.title}".`,
    });
  }

  return NextResponse.json({ attachments: created }, { status: 201 });
}
