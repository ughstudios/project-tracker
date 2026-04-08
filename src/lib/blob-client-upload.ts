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
  | { scope: "project"; projectId: string }
  | { scope: "customer"; customerId: string }
  | { scope: "issue"; issueId: string }
  | { scope: "thread"; issueId: string; threadEntryId: string };

async function completeRegistration(
  completeUrl: string,
  body: { fileName: string; pathname: string; fileUrl: string; fileSize: number },
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

async function uploadOneFileViaRelay(
  file: File,
  tokenExtras: BlobTokenExtras,
  completeUrl: string,
  totalBytesAllFiles: number,
  doneBytesBeforeFile: number,
  onProgress: (percent: number | null) => void,
): Promise<{ ok: boolean; error?: string }> {
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
  };
  if (!compRes.ok) {
    return { ok: false, error: compJson.error ?? UPLOAD_FAILED_GENERIC };
  }
  if (!compJson.url) {
    return { ok: false, error: UPLOAD_FAILED_GENERIC };
  }

  const reg = await completeRegistration(completeUrl, {
    fileName: file.name,
    pathname,
    fileUrl: compJson.url,
    fileSize: file.size,
  });
  if (!reg.ok) return { ok: false, error: reg.error ?? UPLOAD_FAILED_GENERIC };
  return { ok: true };
}

/**
 * Upload files to Vercel Blob via same-origin relay (small chunks → Postgres → server `put()`).
 * Works on custom domains; never touches `vercel.com` from the browser.
 */
export async function uploadFilesViaBlobClient(options: {
  files: File[];
  tokenExtras: BlobTokenExtras;
  completeUrl: string;
  onProgress: (percent: number | null) => void;
}): Promise<{ ok: boolean; error?: string }> {
  const { files, tokenExtras, completeUrl } = options;
  const ready = await assertClientBlobUploadsReady(files);
  if ("error" in ready) return { ok: false, error: ready.error };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  let doneBytes = 0;

  for (const file of files) {
    const relayed = await uploadOneFileViaRelay(
      file,
      tokenExtras,
      completeUrl,
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
