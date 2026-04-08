import { auth } from "@/auth";
import {
  authorizeBlobClientPayload,
  expectedPathPrefix,
  parseBlobClientUploadPayloadFromUnknown,
} from "@/lib/blob-upload-auth";
import { BLOB_RELAY_CHUNK_BYTES } from "@/lib/blob-relay-chunk";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { maxClientBlobUploadBytes, perFileExceedsBlobProductLimitMessage } from "@/lib/issue-files";
import { prisma } from "@/lib/prisma";
import { storedFileName } from "@/lib/stored-file-name";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = vercelUploadsNotReadyResponse();
  if (blocked) return blocked;
  if (!isBlobStorageEnabled() || !getBlobReadWriteToken()) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseBlobClientUploadPayloadFromUnknown(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
  if (!Number.isFinite(fileSize) || fileSize < 1) {
    return NextResponse.json({ error: "fileSize is required." }, { status: 400 });
  }

  const maxB = maxClientBlobUploadBytes();
  if (fileSize > maxB) {
    return NextResponse.json({ error: perFileExceedsBlobProductLimitMessage() }, { status: 400 });
  }

  const authz = await authorizeBlobClientPayload(parsed);
  if ("error" in authz) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const contentTypeRaw = typeof body.contentType === "string" ? body.contentType.trim() : "";
  const contentType =
    contentTypeRaw.length > 0 ? contentTypeRaw.slice(0, 256) : "application/octet-stream";

  const stored = storedFileName(parsed.originalFileName);
  const prefix = expectedPathPrefix(parsed);
  if (!prefix) {
    return NextResponse.json({ error: "Invalid path scope." }, { status: 400 });
  }
  const pathname = `${prefix}${stored}`;

  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await prisma.blobRelayUpload.deleteMany({
    where: { userId: session.user.id, createdAt: { lt: staleBefore } },
  });

  const row = await prisma.blobRelayUpload.create({
    data: {
      userId: session.user.id,
      pathname,
      contentType,
      totalSize: fileSize,
      received: 0,
      nextChunkSeq: 0,
    },
    select: { id: true, pathname: true, totalSize: true },
  });

  return NextResponse.json({
    sessionId: row.id,
    pathname: row.pathname,
    chunkSize: BLOB_RELAY_CHUNK_BYTES,
    totalSize: row.totalSize,
  });
}
