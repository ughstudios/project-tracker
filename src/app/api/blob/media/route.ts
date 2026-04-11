import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { getBlobReadWriteToken, isLikelyVercelBlobUrl } from "@/lib/file-storage";
import { isPrivilegedAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseWorkRecordBlobPathFromUrl } from "@/lib/work-record-blob-path";
import { BlobError, get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function findAttachmentByBlobUrl(
  fileUrl: string,
): Promise<{ fileName: string } | null> {
  const [issueAtt, projectAtt, customerAtt, threadAtt] = await Promise.all([
    prisma.issueAttachment.findFirst({ where: { fileUrl }, select: { fileName: true } }),
    prisma.projectAttachment.findFirst({ where: { fileUrl }, select: { fileName: true } }),
    prisma.customerAttachment.findFirst({ where: { fileUrl }, select: { fileName: true } }),
    prisma.issueThreadAttachment.findFirst({ where: { fileUrl }, select: { fileName: true } }),
  ]);
  const row = issueAtt ?? projectAtt ?? customerAtt ?? threadAtt;
  return row ? { fileName: row.fileName } : null;
}

function fallbackNameFromBlobUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    const seg = path.split("/").filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg.replace(/\+/g, " "));
  } catch {
    /* ignore */
  }
  return "download";
}

/** RFC 6266 filename + RFC 5987 filename* for non-ASCII. */
function contentDispositionHeader(fileName: string, asAttachment: boolean): string {
  const trimmed = fileName.trim().slice(0, 200) || "download";
  const ascii = trimmed.replace(/[\r\n"]/g, "_").replace(/[^\x20-\x7E]/g, "_");
  const type = asAttachment ? "attachment" : "inline";
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(trimmed)}`;
}

/**
 * Streams a Vercel Blob object to logged-in users when the store is private.
 * Query: `?url=` = stored attachment URL. Optional `download=1` uses attachment disposition (Save / download name).
 *
 * Forwards `Range` / `If-Range` so `<video>` can seek and read MP4 metadata (many files need ranged reads).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getBlobStoreAccess() !== "private") {
    return NextResponse.json(
      { error: "Media proxy is disabled when blob access is public (use direct blob URLs)." },
      { status: 404 },
    );
  }

  const reqUrl = new URL(request.url);
  const blobUrl = reqUrl.searchParams.get("url")?.trim() ?? "";
  if (!blobUrl) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }
  if (!isLikelyVercelBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }

  let fileName: string | null = null;
  const attachment = await findAttachmentByBlobUrl(blobUrl);
  if (attachment) {
    fileName = attachment.fileName.trim() || fallbackNameFromBlobUrl(blobUrl);
  } else {
    const wrPath = parseWorkRecordBlobPathFromUrl(blobUrl);
    if (
      wrPath &&
      (wrPath.ownerUserId === session.user.id || isPrivilegedAdmin(session.user.role))
    ) {
      fileName = wrPath.fileName.trim() || fallbackNameFromBlobUrl(blobUrl);
    }
  }
  if (!fileName) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const range = request.headers.get("Range");
  const ifRange = request.headers.get("If-Range");
  const forwardHeaders: Record<string, string> = {};
  if (range) forwardHeaders.Range = range;
  if (ifRange) forwardHeaders["If-Range"] = ifRange;

  let blob;
  try {
    blob = await get(blobUrl, {
      access: "private",
      token,
      ...(Object.keys(forwardHeaders).length > 0 ? { headers: forwardHeaders } : {}),
    });
  } catch (e) {
    if (e instanceof BlobError && /\b416\b/.test(String((e as Error).message))) {
      return new Response(null, { status: 416 });
    }
    console.error("blob media proxy:", e);
    return NextResponse.json({ error: "Failed to load blob." }, { status: 502 });
  }

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const asAttachment = reqUrl.searchParams.get("download") === "1";
  const upstream = blob.headers;
  const contentRange = upstream.get("content-range");
  const status = contentRange ? 206 : 200;

  const headers = new Headers();
  headers.set("Content-Type", blob.blob.contentType || "application/octet-stream");
  headers.set("Content-Disposition", contentDispositionHeader(fileName, asAttachment));
  headers.set("Cache-Control", "private, no-store");

  const contentLength = upstream.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  } else if (status === 200 && blob.blob.size > 0) {
    headers.set("Content-Length", String(blob.blob.size));
  }

  if (contentRange) headers.set("Content-Range", contentRange);

  const acceptRanges = upstream.get("accept-ranges");
  headers.set("Accept-Ranges", acceptRanges || "bytes");

  const etag = upstream.get("etag");
  if (etag) headers.set("ETag", etag);

  const lastModified = upstream.get("last-modified");
  if (lastModified) headers.set("Last-Modified", lastModified);

  return new Response(blob.stream, { status, headers });
}
