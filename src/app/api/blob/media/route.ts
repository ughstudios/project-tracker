import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { getBlobReadWriteToken, isLikelyVercelBlobUrl } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function blobUrlInUse(fileUrl: string): Promise<boolean> {
  const [issueAtt, projectAtt, customerAtt, threadAtt] = await Promise.all([
    prisma.issueAttachment.findFirst({ where: { fileUrl }, select: { id: true } }),
    prisma.projectAttachment.findFirst({ where: { fileUrl }, select: { id: true } }),
    prisma.customerAttachment.findFirst({ where: { fileUrl }, select: { id: true } }),
    prisma.issueThreadAttachment.findFirst({ where: { fileUrl }, select: { id: true } }),
  ]);
  return Boolean(issueAtt || projectAtt || customerAtt || threadAtt);
}

/**
 * Streams a Vercel Blob object to logged-in users when the store is private.
 * Query: `?url=` = stored attachment URL (must exist in DB).
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

  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }
  if (!isLikelyVercelBlobUrl(url)) {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }

  const inUse = await blobUrlInUse(url);
  if (!inUse) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const blob = await get(url, { access: "private", token });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new Response(blob.stream, {
    status: 200,
    headers: {
      "Content-Type": blob.blob.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
