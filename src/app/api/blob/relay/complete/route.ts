import { auth } from "@/auth";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  const buffer = Buffer.concat(upload.chunks.map((c) => Buffer.from(c.data)));

  if (buffer.length !== upload.totalSize) {
    await prisma.blobRelayUpload.delete({ where: { id: upload.id } }).catch(() => {});
    return NextResponse.json({ error: "Size mismatch after assembly." }, { status: 500 });
  }

  let url: string;
  try {
    const blob = await put(upload.pathname, buffer, {
      access: "public",
      token,
      contentType: upload.contentType || "application/octet-stream",
      addRandomSuffix: false,
    });
    url = blob.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Blob put failed.";
    await prisma.blobRelayUpload.delete({ where: { id: upload.id } }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await prisma.blobRelayUpload.delete({ where: { id: upload.id } });

  return NextResponse.json({ url, pathname: upload.pathname });
}
