import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  isBrowserOnVercelDeployment,
  maxClientBlobUploadBytes,
  multipartTooLargeHint,
  perFileExceedsBlobProductLimitMessage,
  vercelBlobRequiredMessage,
} from "@/lib/issue-upload-limits";
import { BLOB_RELAY_CHUNK_BYTES } from "@/lib/blob-relay-chunk";
import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

/**
 * Always use same-origin chunked relay (`/api/blob/relay/*`).
 * Never call `vercel.com/api/blob` from the browser — custom domains (and many others)
 * get CORS-blocked no matter what subdomain heuristic we use.
 */
export function blobUploadNeedsSameOriginRelay(): boolean {
  return true;
}

/** Short, neutral copy — no CORS or hosting lectures. */
const UPLOAD_FAILED_GENERIC =
  "Couldn’t upload the file. Check your connection and try again.";

function displayNameAfterHeicConversion(originalName: string): string {
  const n = originalName.trim() || "image";
  if (/\.(heic|heif)$/i.test(n)) return n.replace(/\.(heic|heif)$/i, ".jpg");
  return n.toLowerCase().endsWith(".jpg") ? n : `${n}.jpg`;
}

export async function isBlobClientUploadEnabled(): Promise<boolean> {
  try {
    const r = await fetch("/api/blob/status", { credentials: "include", cache: "no-store" });
    const d = r.ok ? ((await r.json()) as { enabled?: boolean }) : { enabled: false };
    return Boolean(d.enabled);
  } catch {
    return false;
  }
}

export function validateFilesBeforeUpload(files: File[]): string | null {
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per upload.`;
  }
  const cap = maxClientBlobUploadBytes();
  for (const f of files) {
    if (f.size > cap) return perFileExceedsBlobProductLimitMessage();
  }
  return null;
}

/** @deprecated Prefer {@link assertClientBlobUploadsReady}; kept for any external imports. */
export function validateFilesBeforeMultipartUpload(files: File[]): string | null {
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per upload.`;
  }
  const cap = maxClientBlobUploadBytes();
  const sum = files.reduce((s, f) => s + f.size, 0);
  if (sum > VERCEL_SERVER_MULTIPART_BUDGET_BYTES) {
    return isBrowserOnVercelDeployment() ? multipartTooLargeHint() : "Total upload size is too large for one request.";
  }
  for (const f of files) {
    if (f.size > cap) {
      return isBrowserOnVercelDeployment()
        ? multipartTooLargeHint()
        : perFileExceedsBlobProductLimitMessage();
    }
  }
  return null;
}

/**
 * Ensures Vercel Blob is configured and files are within product limits.
 */
export async function assertClientBlobUploadsReady(
  files: File[],
): Promise<{ ok: true } | { error: string }> {
  if (!(await isBlobClientUploadEnabled())) {
    return { error: vercelBlobRequiredMessage() };
  }
  const pre = validateFilesBeforeUpload(files);
  if (pre) return { error: pre };
  return { ok: true };
}

/** @deprecated Use {@link assertClientBlobUploadsReady}. */
export async function resolveBlobVsMultipartUpload(
  files: File[],
): Promise<{ useBlob: true } | { useBlob: false } | { error: string }> {
  const r = await assertClientBlobUploadsReady(files);
  if ("error" in r) return r;
  return { useBlob: true };
}

export type BlobTokenExtras =
  | { scope: "workRecord" }
  | { scope: "project"; projectId: string }
  | { scope: "customer"; customerId: string }
  | { scope: "issue"; issueId: string }
  | { scope: "thread"; issueId: string; threadEntryId: string };

async function completeRegistration(
  completeUrl: string,
  body: {
    fileName: string;
    pathname: string;
    fileUrl: string;
    fileSize: number;
    uploadNote: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(completeUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: raw.error ?? UPLOAD_FAILED_GENERIC };
  }
  return { ok: true };
}

/** Pasted images only (jpeg, png, gif, webp, svg). */
export function validatePastedImagesForWorkRecord(files: File[]): string | null {
  if (files.length === 0) return null;
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} images per paste.`;
  }
  const cap = maxClientBlobUploadBytes();
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      return "Only image files can be pasted into work records.";
    }
    if (f.size > cap) return perFileExceedsBlobProductLimitMessage();
  }
  return null;
}

async function relayUploadFileToBlob(
  file: File,
  tokenExtras: BlobTokenExtras,
  totalBytesAllFiles: number,
  doneBytesBeforeFile: number,
  onProgress: (percent: number | null) => void,
): Promise<
  | { ok: true; url: string; pathname: string; fileSize: number; heicConverted: boolean }
  | { ok: false; error: string }
> {
  const initRes = await fetch("/api/blob/relay/init", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...tokenExtras,
      originalFileName: file.name,
      fileSize: file.size,
      contentType: file.type ? file.type : "application/octet-stream",
    }),
  });
  const initJson = (await initRes.json().catch(() => ({}))) as {
    error?: string;
    sessionId?: string;
    pathname?: string;
    chunkSize?: number;
  };
  if (!initRes.ok) {
    return { ok: false, error: initJson.error ?? UPLOAD_FAILED_GENERIC };
  }
  const sessionId = initJson.sessionId;
  const pathname = initJson.pathname;
  const chunkSize = initJson.chunkSize ?? BLOB_RELAY_CHUNK_BYTES;
  if (!sessionId || !pathname) {
    return { ok: false, error: UPLOAD_FAILED_GENERIC };
  }

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const slice = file.slice(offset, end);
    const chunkRes = await fetch("/api/blob/relay/chunk", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Blob-Relay-Session": sessionId,
      },
      body: slice,
    });
    const chunkJson = (await chunkRes.json().catch(() => ({}))) as { error?: string };
    if (!chunkRes.ok) {
      return { ok: false, error: chunkJson.error ?? UPLOAD_FAILED_GENERIC };
    }
    offset = end;
    const pct = Math.min(
      100,
      Math.round(((doneBytesBeforeFile + offset) / totalBytesAllFiles) * 100),
    );
    onProgress(pct);
  }

  const compRes = await fetch("/api/blob/relay/complete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const compJson = (await compRes.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    pathname?: string;
    fileSize?: number;
    heicConverted?: boolean;
  };
  if (!compRes.ok) {
    return { ok: false, error: compJson.error ?? UPLOAD_FAILED_GENERIC };
  }
  if (!compJson.url) {
    return { ok: false, error: UPLOAD_FAILED_GENERIC };
  }

  const outPathname = typeof compJson.pathname === "string" ? compJson.pathname : pathname;
  const fileSize =
    typeof compJson.fileSize === "number" && Number.isFinite(compJson.fileSize)
      ? compJson.fileSize
      : file.size;
  const heicConverted = Boolean(compJson.heicConverted);

  return { ok: true, url: compJson.url, pathname: outPathname, fileSize, heicConverted };
}

async function uploadOneFileViaRelay(
  file: File,
  tokenExtras: BlobTokenExtras,
  completeUrl: string,
  uploadNote: string,
  totalBytesAllFiles: number,
  doneBytesBeforeFile: number,
  onProgress: (percent: number | null) => void,
): Promise<{ ok: boolean; error?: string }> {
  const relayed = await relayUploadFileToBlob(
    file,
    tokenExtras,
    totalBytesAllFiles,
    doneBytesBeforeFile,
    onProgress,
  );
  if (!relayed.ok) return { ok: false, error: relayed.error };

  const reg = await completeRegistration(completeUrl, {
    fileName: relayed.heicConverted ? displayNameAfterHeicConversion(file.name) : file.name,
    pathname: relayed.pathname,
    fileUrl: relayed.url,
    fileSize: relayed.fileSize,
    uploadNote,
  });
  if (!reg.ok) return { ok: false, error: reg.error ?? UPLOAD_FAILED_GENERIC };
  return { ok: true };
}

/**
 * Upload pasted images for work record content (blob only; no attachment rows).
 * Inserts canonical `![](url)` lines in the client after this returns.
 */
export async function uploadWorkRecordPasteImages(options: {
  files: File[];
  onProgress: (percent: number | null) => void;
}): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  const pre = validatePastedImagesForWorkRecord(options.files);
  if (pre) return { ok: false, error: pre };
  const ready = await assertClientBlobUploadsReady(options.files);
  if ("error" in ready) return { ok: false, error: ready.error };

  const { files } = options;
  const tokenExtras: BlobTokenExtras = { scope: "workRecord" };
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  let doneBytes = 0;
  const urls: string[] = [];

  for (const file of files) {
    const up = await relayUploadFileToBlob(
      file,
      tokenExtras,
      totalBytes,
      doneBytes,
      options.onProgress,
    );
    if (!up.ok) return { ok: false, error: up.error };
    urls.push(up.url);
    doneBytes += file.size;
    options.onProgress(Math.min(100, Math.round((doneBytes / totalBytes) * 100)));
  }

  options.onProgress(100);
  return { ok: true, urls };
}

/**
 * Upload files to Vercel Blob via same-origin relay (small chunks → Postgres → server `put()`).
 * Works on custom domains; never touches `vercel.com` from the browser.
 */
export async function uploadFilesViaBlobClient(options: {
  files: File[];
  tokenExtras: BlobTokenExtras;
  completeUrl: string;
  /** Required: explains why the file(s) are being uploaded (stored per file). */
  uploadNote: string;
  onProgress: (percent: number | null) => void;
}): Promise<{ ok: boolean; error?: string }> {
  const { files, tokenExtras, completeUrl, uploadNote } = options;
  const ready = await assertClientBlobUploadsReady(files);
  if ("error" in ready) return { ok: false, error: ready.error };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  let doneBytes = 0;

  for (const file of files) {
    const relayed = await uploadOneFileViaRelay(
      file,
      tokenExtras,
      completeUrl,
      uploadNote,
      totalBytes,
      doneBytes,
      options.onProgress,
    );
    if (!relayed.ok) return { ok: false, error: relayed.error };
    doneBytes += file.size;
    options.onProgress(Math.min(100, Math.round((doneBytes / totalBytes) * 100)));
  }

  options.onProgress(100);
  return { ok: true };
}
