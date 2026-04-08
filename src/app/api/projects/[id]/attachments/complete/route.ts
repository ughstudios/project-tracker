import { auth } from "@/auth";
import { parseRequiredUploadNote } from "@/lib/attachment-upload-note";
import { writeAuditLog } from "@/lib/audit";
import { blobPublicUrlMatchesPathname } from "@/lib/blob-url-verify";
import { isBlobStorageEnabled, isLikelyVercelBlobUrl } from "@/lib/file-storage";
import { maxClientBlobUploadBytes, perFileExceedsBlobProductLimitMessage } from "@/lib/issue-files";
import { prisma } from "@/lib/prisma";
import path from "node:path";
import { NextResponse } from "next/server";

const uploaderSelect = { select: { id: true, name: true, email: true } as const };

function singleSegmentAfterPrefix(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix) || pathname.length <= prefix.length) return false;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isBlobStorageEnabled()) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    fileName?: string;
    pathname?: string;
    fileUrl?: string;
    fileSize?: number;
    uploadNote?: string;
  };
  const noteParsed = parseRequiredUploadNote(body.uploadNote);
  if ("error" in noteParsed) {
    return NextResponse.json({ error: noteParsed.error }, { status: 400 });
  }
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const pathname = typeof body.pathname === "string" ? body.pathname.trim() : "";
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

  if (!fileName || !pathname || !fileUrl || !Number.isFinite(fileSize) || fileSize < 1) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (fileSize > maxClientBlobUploadBytes()) {
    return NextResponse.json({ error: perFileExceedsBlobProductLimitMessage() }, { status: 400 });
  }
  if (!isLikelyVercelBlobUrl(fileUrl) || !blobPublicUrlMatchesPathname(fileUrl, pathname)) {
    return NextResponse.json({ error: "Invalid file URL." }, { status: 400 });
  }
  const prefix = `projects/${projectId}/`;
  if (!singleSegmentAfterPrefix(pathname, prefix)) {
    return NextResponse.json({ error: "Invalid pathname." }, { status: 400 });
  }

  const ext = path.extname(fileName).toLowerCase();
  const attachment = await prisma.projectAttachment.create({
    data: {
      projectId,
      uploaderId: session.user.id,
      fileName,
      fileUrl,
      fileType: ext ? ext.slice(1) : "bin",
      fileSize,
      uploadNote: noteParsed.uploadNote,
    },
    include: { uploader: uploaderSelect },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "ProjectAttachment",
    entityId: attachment.id,
    action: "UPLOAD",
    description: `${fileName} attached to project ${projectId}.`,
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
