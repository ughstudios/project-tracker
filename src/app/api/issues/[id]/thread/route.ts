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

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const content = String(formData.get("content") ?? "").trim();
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if ((key === "file" || key === "files") && value instanceof File && value.size > 0) {
        files.push(value);
      }
    }
    if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
      return NextResponse.json(
        { error: `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per post.` },
        { status: 400 },
      );
    }
    for (const f of files) {
      if (f.size > ISSUE_UPLOAD_MAX_BYTES) {
        return NextResponse.json({ error: "One or more files are too large." }, { status: 400 });
      }
    }
    if (!content && files.length === 0) {
      return NextResponse.json(
        { error: "Message or at least one file is required." },
        { status: 400 },
      );
    }

    const entry = await prisma.issueThreadEntry.create({
      data: {
        issueId,
        authorId: session.user.id,
        content: content || "",
      },
      include: { author: uploaderSelect },
    });

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "issues",
      issueId,
      "thread",
      entry.id,
    );
    await fs.mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storedName = storedFileName(file.name);
      const fullPath = path.join(uploadDir, storedName);
      await fs.writeFile(fullPath, buffer);
      const ext = path.extname(file.name).toLowerCase();
      const fileUrl = `/uploads/issues/${issueId}/thread/${entry.id}/${storedName}`;
      await prisma.issueThreadAttachment.create({
        data: {
          threadEntryId: entry.id,
          uploaderId: session.user.id,
          fileName: file.name,
          fileUrl,
          fileType: ext ? ext.slice(1) : "bin",
          fileSize: file.size,
        },
      });
    }

    const withAttachments = await prisma.issueThreadEntry.findUnique({
      where: { id: entry.id },
      include: {
        author: uploaderSelect,
        attachments: { orderBy: { createdAt: "asc" }, include: { uploader: uploaderSelect } },
      },
    });
    if (!withAttachments) {
      return NextResponse.json({ error: "Failed to load new thread entry." }, { status: 500 });
    }

    await writeAuditLog({
      actorId: session.user.id,
      entityType: "IssueThreadEntry",
      entityId: entry.id,
      action: "CREATE",
      description: `Thread reply on issue "${issue.title}".`,
    });

    return NextResponse.json(withAttachments, { status: 201 });
  }

  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim() ?? "";
  if (!content) {
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
