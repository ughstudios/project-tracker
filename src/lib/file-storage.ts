import { del, put } from "@vercel/blob";
import {
  VERCEL_BLOB_SETUP_AND_REDEPLOY_MESSAGE,
  vercelBlobRequiredMessage,
} from "@/lib/issue-upload-limits";
import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Files go through the route handler first, so total payload must stay under this budget.
 *
 * We use `access: 'public'` on `put()` so `<img>`, `<a href>`, and `<video src>` work with
 * the URL stored in Postgres. `access: 'private'` would require signed URLs or a download proxy.
 */
export { VERCEL_SERVER_MULTIPART_BUDGET_BYTES };

/**
 * Read/write token Vercel injects when a Blob store is **connected to this project**.
 * No store ID or region is configured in code—the token selects the store (e.g. IAD1).
 */
export function getBlobReadWriteToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

export function isBlobStorageEnabled(): boolean {
  return Boolean(getBlobReadWriteToken());
}

/** Total file bytes (+ optional UTF-8 text field) too large for one serverless invocation on Vercel. */
export function vercelMultipartPayloadTooLargeResponse(
  files: { size: number }[],
  extraUtf8Bytes = 0,
): NextResponse | null {
  if (process.env.VERCEL !== "1") return null;
  const filesSum = files.reduce((a, f) => a + f.size, 0);
  if (filesSum + extraUtf8Bytes <= VERCEL_SERVER_MULTIPART_BUDGET_BYTES) return null;
  const mb = Math.max(1, Math.floor(VERCEL_SERVER_MULTIPART_BUDGET_BYTES / (1024 * 1024)));
  return NextResponse.json(
    {
      error: `Total upload size exceeds about ${mb} MB for one request on Vercel (including all files in the same upload). Send fewer or smaller files per request. ${VERCEL_BLOB_SETUP_AND_REDEPLOY_MESSAGE}`,
    },
    { status: 413 },
  );
}

/** Vercel serverless has a read-only filesystem under /var/task; uploads must use Blob. */
export function vercelUploadsNotReadyResponse(): NextResponse | null {
  if (process.env.VERCEL !== "1") return null;
  if (isBlobStorageEnabled()) return null;
  return NextResponse.json({ error: vercelBlobRequiredMessage() }, { status: 503 });
}

function isHttpUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("http://") || fileUrl.startsWith("https://");
}

export function isLikelyVercelBlobUrl(fileUrl: string): boolean {
  return fileUrl.includes("blob.vercel-storage.com");
}

export async function deleteBlobUrlIfPresent(fileUrl: string): Promise<void> {
  if (!isLikelyVercelBlobUrl(fileUrl)) return;
  const token = getBlobReadWriteToken();
  if (!token) return;
  try {
    await del(fileUrl, { token });
  } catch {
    // ignore missing or already deleted
  }
}

export type WriteUploadedFileOptions = {
  buffer: Buffer;
  /** Blob object key, e.g. issues/{issueId}/{storedName} */
  blobPathname: string;
  localDir: string;
  /** e.g. /uploads/issues/{issueId} */
  publicUrlDir: string;
  fileName: string;
  contentType?: string;
};

export async function writeUploadedFile(
  opts: WriteUploadedFileOptions,
): Promise<{ fileUrl: string }> {
  const blobToken = getBlobReadWriteToken();
  if (blobToken) {
    const blob = await put(opts.blobPathname, opts.buffer, {
      access: "public",
      token: blobToken,
      contentType: opts.contentType || "application/octet-stream",
      addRandomSuffix: false,
    });
    return { fileUrl: blob.url };
  }

  await fs.mkdir(opts.localDir, { recursive: true });
  const fullPath = path.join(opts.localDir, opts.fileName);
  await fs.writeFile(fullPath, opts.buffer);
  const base = opts.publicUrlDir.replace(/\/$/, "");
  return { fileUrl: `${base}/${opts.fileName}` };
}

/** After blob delete, skip local unlink for remote URLs. */
export function shouldSkipLocalDelete(fileUrl: string): boolean {
  return isHttpUrl(fileUrl);
}

export function contentTypeForUpload(file: File): string {
  if (file.type) return file.type;
  const ext = path.extname(file.name).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".cbp": "application/octet-stream",
    ".rcvbp": "application/octet-stream",
  };
  return map[ext] ?? "application/octet-stream";
}
