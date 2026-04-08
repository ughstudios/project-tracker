import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { getBlobReadWriteToken, isLikelyVercelBlobUrl } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { get } from "@vercel/blob";
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

  const attachment = await findAttachmentByBlobUrl(blobUrl);
  if (!attachment) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const fileName = attachment.fileName.trim() || fallbackNameFromBlobUrl(blobUrl);

  const token = getBlobReadWriteToken();
  if (!token) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const blob = await get(blobUrl, { access: "private", token });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const asAttachment = reqUrl.searchParams.get("download") === "1";

  return new Response(blob.stream, {
    status: 200,
    headers: {
      "Content-Type": blob.blob.contentType || "application/octet-stream",
      "Content-Disposition": contentDispositionHeader(fileName, asAttachment),
      "Cache-Control": "private, no-store",
    },
  });
}
