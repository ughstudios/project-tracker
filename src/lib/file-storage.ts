import { del, put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Vercel serverless has a read-only filesystem under /var/task; uploads must use Blob. */
export function vercelUploadsNotReadyResponse(): NextResponse | null {
  if (process.env.VERCEL !== "1") return null;
  if (isBlobStorageEnabled()) return null;
  return NextResponse.json(
    {
      error:
        "File uploads require Vercel Blob. In the Vercel dashboard open Storage, create a Blob store, and connect it to this project so BLOB_READ_WRITE_TOKEN is set.",
    },
    { status: 503 },
  );
}

function isHttpUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("http://") || fileUrl.startsWith("https://");
}

export function isLikelyVercelBlobUrl(fileUrl: string): boolean {
  return fileUrl.includes("blob.vercel-storage.com");
}

export async function deleteBlobUrlIfPresent(fileUrl: string): Promise<void> {
  if (!isLikelyVercelBlobUrl(fileUrl)) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
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
  if (isBlobStorageEnabled()) {
    const blob = await put(opts.blobPathname, opts.buffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
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
