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

export async function GET(
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
    select: { id: true, archivedAt: true },
  });
  if (!issue || issue.archivedAt) {
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

  return NextResponse.json({ entries, total, page, pageSize, totalPages });
}

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
    const blocked = vercelUploadsNotReadyResponse();
    if (blocked) return blocked;

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
    const maxBytes = maxIssueUploadBytesForRuntime();
    for (const f of files) {
      if (f.size > maxBytes) {
        return NextResponse.json({ error: "One or more files are too large." }, { status: 400 });
      }
    }
    const tooLarge = vercelMultipartPayloadTooLargeResponse(
      files,
      Buffer.byteLength(content, "utf8"),
    );
    if (tooLarge) return tooLarge;
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

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storedName = storedFileName(file.name);
      const ext = path.extname(file.name).toLowerCase();
      const { fileUrl } = await writeUploadedFile({
        buffer,
        blobPathname: `issues/${issueId}/thread/${entry.id}/${storedName}`,
        localDir: uploadDir,
        publicUrlDir: `/uploads/issues/${issueId}/thread/${entry.id}`,
        fileName: storedName,
        contentType: contentTypeForUpload(file),
      });
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
