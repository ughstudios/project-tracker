import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { getBlobReadWriteToken, isLikelyVercelBlobUrl } from "@/lib/file-storage";
import { isPrivilegedAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseWorkRecordBlobPathFromUrl } from "@/lib/work-record-blob-path";
import { head } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type ResolvedMedia =
  | {
      ok: true;
      blobUrl: string;
      fileName: string;
      token: string;
      asAttachment: boolean;
    }
  | { ok: false; response: Response };

async function resolvePrivateBlobMedia(request: Request): Promise<ResolvedMedia> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (getBlobStoreAccess() !== "private") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Media proxy is disabled when blob access is public (use direct blob URLs)." },
        { status: 404 },
      ),
    };
  }

  const reqUrl = new URL(request.url);
  const blobUrl = reqUrl.searchParams.get("url")?.trim() ?? "";
  if (!blobUrl) {
    return { ok: false, response: NextResponse.json({ error: "Missing url." }, { status: 400 }) };
  }
  if (!isLikelyVercelBlobUrl(blobUrl)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid url." }, { status: 400 }) };
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
    return { ok: false, response: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 }),
    };
  }

  const asAttachment = reqUrl.searchParams.get("download") === "1";
  return { ok: true, blobUrl, fileName, token, asAttachment };
}

function buildClientHeaders(
  upstream: Response,
  fileName: string,
  asAttachment: boolean,
): Headers {
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  else headers.set("Content-Type", "application/octet-stream");

  headers.set("Content-Disposition", contentDispositionHeader(fileName, asAttachment));
  headers.set("Cache-Control", "private, no-store");

  for (const name of [
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ] as const) {
    const v = upstream.headers.get(name);
    if (v) headers.set(name, v);
  }
  if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");

  return headers;
}

/**
 * Streams a Vercel Blob object to logged-in users when the store is private.
 * Query: `?url=` = stored attachment URL. Optional `download=1` uses attachment disposition (Save / download name).
 *
 * Uses a direct authenticated fetch (same as the Blob SDK) and preserves real status codes (200 / 206 / 304)
 * plus Range-related headers so `<video>` can decode and seek.
 */
export async function GET(request: Request): Promise<Response> {
  const resolved = await resolvePrivateBlobMedia(request);
  if (!resolved.ok) return resolved.response;

  const { blobUrl, fileName, token, asAttachment } = resolved;

  const range = request.headers.get("Range");
  const ifRange = request.headers.get("If-Range");
  const originHeaders: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  if (range) originHeaders.Range = range;
  if (ifRange) originHeaders["If-Range"] = ifRange;

  let upstream: Response;
  try {
    upstream = await fetch(blobUrl, {
      method: "GET",
      headers: originHeaders,
      cache: "no-store",
    });
  } catch (e) {
    console.error("blob media proxy fetch:", e);
    return NextResponse.json({ error: "Failed to load blob." }, { status: 502 });
  }

  if (upstream.status === 404) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (upstream.status === 416) {
    return new Response(null, { status: 416 });
  }
  if (upstream.status === 304) {
    const headers = buildClientHeaders(upstream, fileName, asAttachment);
    return new Response(null, { status: 304, headers });
  }
  if (!upstream.ok) {
    console.error("blob media unexpected status:", upstream.status);
    return NextResponse.json({ error: "Failed to load blob." }, { status: 502 });
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const headers = buildClientHeaders(upstream, fileName, asAttachment);
  return new Response(upstream.body, { status: upstream.status, headers });
}

/** Metadata probe (some clients use HEAD before ranged GET). */
export async function HEAD(request: Request): Promise<Response> {
  const resolved = await resolvePrivateBlobMedia(request);
  if (!resolved.ok) return resolved.response;

  const { blobUrl, fileName, token, asAttachment } = resolved;

  let meta;
  try {
    meta = await head(blobUrl, { token });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", meta.contentType || "application/octet-stream");
  headers.set("Content-Length", String(meta.size));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Disposition", contentDispositionHeader(fileName, asAttachment));
  headers.set("Cache-Control", "private, no-store");
  if (meta.etag) headers.set("ETag", meta.etag);

  return new Response(null, { status: 200, headers });
}
