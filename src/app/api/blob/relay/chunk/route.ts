import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { BLOB_RELAY_CHUNK_BYTES, relayStagingPathname } from "@/lib/blob-relay-chunk";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CHUNK = BLOB_RELAY_CHUNK_BYTES;

class RelayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

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

  const sessionId = request.headers.get("x-blob-relay-session")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "Missing X-Blob-Relay-Session." }, { status: 400 });
  }

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Empty chunk." }, { status: 400 });
  }
  if (buf.length > MAX_CHUNK) {
    return NextResponse.json({ error: "Chunk too large." }, { status: 413 });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(842163, abs(hashtext(${sessionId}::text)))`,
        );
        const upload = await tx.blobRelayUpload.findUnique({
          where: { id: sessionId },
        });
        if (!upload || upload.userId !== session.user.id) {
          throw new RelayError(404, "Upload session not found.");
        }
        const nextOff = upload.received;
        if (nextOff + buf.length > upload.totalSize) {
          throw new RelayError(400, "Chunk exceeds remaining size.");
        }
        const isLast = nextOff + buf.length === upload.totalSize;
        if (!isLast && buf.length !== MAX_CHUNK) {
          throw new RelayError(400, "Intermediate chunks must be full size.");
        }

        const seq = upload.nextChunkSeq;
        const stagingPath = relayStagingPathname(upload.pathname, upload.id, seq);
        const staged = await put(stagingPath, buf, {
          access: getBlobStoreAccess(),
          token,
          contentType: "application/octet-stream",
          addRandomSuffix: false,
        });

        await tx.blobRelayChunk.create({
          data: {
            sessionId: upload.id,
            seq,
            partUrl: staged.url,
          },
        });
        await tx.blobRelayUpload.update({
          where: { id: upload.id },
          data: {
            received: nextOff + buf.length,
            nextChunkSeq: seq + 1,
          },
        });
      },
      { maxWait: 15_000, timeout: 115_000 },
    );
  } catch (e) {
    if (e instanceof RelayError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Chunk failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
