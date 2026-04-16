import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import {
  bufferFromRelayPartUrls,
  deleteRelayStagingBlobUrls,
  mergedReadableStreamFromRelayPartUrls,
} from "@/lib/blob-relay-assemble";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { maybeConvertHeicForBlobUpload, uploadLooksHeicFromMeta } from "@/lib/heic-blob-convert";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MULTIPART_PUT_THRESHOLD = 8 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = vercelUploadsNotReadyResponse();
  if (blocked) return blocked;
  const token = getBlobReadWriteToken();
  if (!isBlobStorageEnabled() || !token) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const upload = await prisma.blobRelayUpload.findUnique({
    where: { id: sessionId },
    include: { chunks: { orderBy: { seq: "asc" } } },
  });

  if (!upload || upload.userId !== session.user.id) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }

  if (upload.received !== upload.totalSize) {
    return NextResponse.json(
      { error: "Upload is incomplete.", received: upload.received, totalSize: upload.totalSize },
      { status: 400 },
    );
  }

  if (upload.chunks.length === 0) {
    return NextResponse.json({ error: "No data uploaded." }, { status: 400 });
  }

  const partUrls = upload.chunks.map((c) => c.partUrl);

  const releaseSession = async () => {
    await deleteRelayStagingBlobUrls(partUrls);
    await prisma.blobRelayUpload.delete({ where: { id: upload.id } }).catch(() => {});
  };

  const contentType = upload.contentType || "application/octet-stream";

  let putPathname = upload.pathname;
  let putContentType = contentType;
  let heicConverted = false;
  let putBody: Buffer | ReadableStream<Uint8Array>;
  let outFileSize: number;

  try {
    if (uploadLooksHeicFromMeta(upload.pathname, upload.contentType)) {
      const buffer = await bufferFromRelayPartUrls(partUrls, token);
      if (buffer.length !== upload.totalSize) {
        await releaseSession();
        return NextResponse.json({ error: "Size mismatch after assembly." }, { status: 500 });
      }
      let converted;
      try {
        converted = await maybeConvertHeicForBlobUpload({
          buffer,
          pathname: upload.pathname,
          contentType,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not convert image.";
        await releaseSession();
        return NextResponse.json({ error: message }, { status: 422 });
      }
      putBody = converted.buffer;
      putPathname = converted.pathname;
      putContentType = converted.contentType;
      heicConverted = converted.heicConverted;
      outFileSize = putBody.length;
    } else {
      putBody = mergedReadableStreamFromRelayPartUrls(partUrls, token);
      outFileSize = upload.totalSize;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read staging parts.";
    await releaseSession();
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let url: string;
  try {
    // Multipart uploads require a known size; `computeBodyLength` is 0 for ReadableStream.
    const useMultipart =
      Buffer.isBuffer(putBody) && outFileSize >= MULTIPART_PUT_THRESHOLD;
    const blob = await put(putPathname, putBody, {
      access: getBlobStoreAccess(),
      token,
      contentType: putContentType || "application/octet-stream",
      addRandomSuffix: false,
      multipart: useMultipart,
    });
    url = blob.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Blob put failed.";
    await releaseSession();
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await deleteRelayStagingBlobUrls(partUrls).catch(() => {});
  await prisma.blobRelayUpload.delete({ where: { id: upload.id } });

  return NextResponse.json({
    url,
    pathname: putPathname,
    fileSize: outFileSize,
    heicConverted,
  });
}
