import { auth } from "@/auth";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { getBlobReadWriteToken, isLikelyVercelBlobUrl } from "@/lib/file-storage";
import { isPrivilegedAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseWorkRecordBlobPathFromUrl } from "@/lib/work-record-blob-path";
import { Prisma } from "@/generated/prisma";
import { head } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Pro (and above) can use 60s; Hobby is capped lower — still set so Pro isn’t stuck at the default. */
export const maxDuration = 60;

/** Ranged video playback hammers this route; cache resolved file names to skip repeat DB round-trips. */
const ATTACHMENT_NAME_TTL_MS = 5 * 60 * 1000;
const ATTACHMENT_NAME_MAX = 400;
const attachmentNameByUrl = new Map<string, { name: string; t: number }>();

function cachedAttachmentName(url: string): string | undefined {
  const e = attachmentNameByUrl.get(url);
  if (!e || Date.now() - e.t > ATTACHMENT_NAME_TTL_MS) {
    if (e) attachmentNameByUrl.delete(url);
    return undefined;
  }
  return e.name;
}

function rememberAttachmentName(url: string, name: string) {
  if (attachmentNameByUrl.size >= ATTACHMENT_NAME_MAX) {
    const k = attachmentNameByUrl.keys().next().value;
    if (k !== undefined) attachmentNameByUrl.delete(k);
  }
  attachmentNameByUrl.set(url, { name, t: Date.now() });
}

/** One DB round-trip (video playback issues many sequential range requests). */
async function findAttachmentByBlobUrl(
  fileUrl: string,
): Promise<{ fileName: string } | null> {
  const hit = cachedAttachmentName(fileUrl);
  if (hit) return { fileName: hit };

  const rows = await prisma.$queryRaw<{ fileName: string }[]>(Prisma.sql`
    SELECT "fileName" FROM "IssueAttachment" WHERE "fileUrl" = ${fileUrl}
    UNION ALL
    SELECT "fileName" FROM "ProjectAttachment" WHERE "fileUrl" = ${fileUrl}
    UNION ALL
    SELECT "fileName" FROM "CustomerAttachment" WHERE "fileUrl" = ${fileUrl}
    UNION ALL
    SELECT "fileName" FROM "IssueThreadAttachment" WHERE "fileUrl" = ${fileUrl}
    LIMIT 1
  `);
  const row = rows[0];
  if (row?.fileName) rememberAttachmentName(fileUrl, row.fileName);
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
 * Vercel Blob often serves `application/octet-stream`; browsers then treat video as non-playable
 * and leave the play control disabled. Prefer a concrete type from the stored file name.
 */
function contentTypeForFileName(fileName: string, upstreamContentType: string | null): string {
  const raw = upstreamContentType?.split(";")[0]?.trim() ?? "";
  const base = raw.toLowerCase();
  if (base && base !== "application/octet-stream" && base !== "binary/octet-stream") {
    return raw;
  }
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  const byExt: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
  };
  if (ext && byExt[ext]) return byExt[ext];
  return raw || "application/octet-stream";
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
  headers.set(
    "Content-Type",
    contentTypeForFileName(fileName, upstream.headers.get("content-type")),
  );

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
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    const err = e instanceof Error ? e : null;
    if (
      err &&
      (err.name === "TimeoutError" ||
        err.name === "AbortError" ||
        /aborted|timeout/i.test(err.message))
    ) {
      return NextResponse.json({ error: "Blob read timed out." }, { status: 504 });
    }
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
  headers.set("Content-Type", contentTypeForFileName(fileName, meta.contentType || null));
  headers.set("Content-Length", String(meta.size));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Disposition", contentDispositionHeader(fileName, asAttachment));
  headers.set("Cache-Control", "private, no-store");
  if (meta.etag) headers.set("ETag", meta.etag);

  return new Response(null, { status: 200, headers });
}
