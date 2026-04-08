import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  isBrowserOnVercelDeployment,
  maxClientBlobUploadBytes,
  multipartTooLargeHint,
  perFileExceedsBlobProductLimitMessage,
  vercelBlobRequiredMessage,
} from "@/lib/issue-upload-limits";
import { BLOB_RELAY_CHUNK_BYTES } from "@/lib/blob-relay-chunk";
import { storedFileName } from "@/lib/stored-file-name";
import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

const CLIENT_UPLOAD_HANDLE_URL = "/api/blob/client-upload";

/**
 * Browser uploads to Vercel’s Blob API are only same-origin-friendly on `*.vercel.app`.
 * All other hosts (e.g. custom domains, localhost) use our chunked relay to avoid CORS.
 */
export function blobUploadNeedsSameOriginRelay(): boolean {
  if (typeof window === "undefined") return false;
  return !window.location.hostname.endsWith(".vercel.app");
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

function userFacingUploadError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e)).trim();
  if (!raw || raw === "undefined") return UPLOAD_FAILED_GENERIC;
  const lo = raw.toLowerCase();
  if (lo.includes("not authenticated") || lo.includes("unauthorized")) {
    return "Your session may have expired. Sign in again, then retry the upload.";
  }
  if (lo.includes("not allowed") || lo.includes("content-type")) {
    return "This file type can’t be uploaded here.";
  }
  if (lo.includes("too large") || lo.includes("maximum")) {
    return perFileExceedsBlobProductLimitMessage();
  }
  if (lo.includes("could not save") || lo.includes("invalid file url")) {
    return UPLOAD_FAILED_GENERIC;
  }
  return UPLOAD_FAILED_GENERIC;
}

/**
 * Ensures Vercel Blob is configured and files are within product limits.
 * Does not block uploads based on hostname — we try the real upload and only surface short errors if it fails.
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

function blobPathPrefix(extras: BlobTokenExtras): string {
  switch (extras.scope) {
    case "project":
      return `projects/${extras.projectId}/`;
    case "customer":
      return `customers/${extras.customerId}/`;
    case "issue":
      return `issues/${extras.issueId}/`;
    case "thread":
      return `issues/${extras.issueId}/thread/${extras.threadEntryId}/`;
    default:
      return "";
  }
}

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

const BLOB_UPLOAD_MAX_ATTEMPTS = 5;
const BLOB_UPLOAD_RETRY_BASE_MS = 1_200;
const BLOB_UPLOAD_RETRY_MAX_MS = 12_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isTransientBlobNetworkError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (
    msg.includes("too large") ||
    msg.includes("forbidden") ||
    msg.includes("unauthorized") ||
    msg.includes("not allowed") ||
    /\b40[0-9]\b/.test(msg)
  ) {
    return false;
  }
  if (e instanceof TypeError) return true;
  return (
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("network") ||
    msg.includes("aborted") ||
    msg.includes("timeout") ||
    msg.includes("err_network") ||
    msg.includes("network_changed") ||
    msg.includes("connection") ||
    /\b50[234]\b/.test(msg) ||
    msg.includes("408")
  );
}

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
  const useRelay = blobUploadNeedsSameOriginRelay();
  const blobClient = useRelay ? null : await import("@vercel/blob/client");
  const prefix = blobPathPrefix(tokenExtras);

  for (const file of files) {
    if (useRelay) {
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
      continue;
    }

    const stored = storedFileName(file.name);
    const pathname = `${prefix}${stored}`;
    const clientPayload = JSON.stringify({
      ...tokenExtras,
      originalFileName: file.name,
    });

    let blobUrl: string | undefined;

    for (let attempt = 1; attempt <= BLOB_UPLOAD_MAX_ATTEMPTS; attempt++) {
      try {
        const uploaded = await blobClient!.upload(pathname, file, {
          access: "public",
          handleUploadUrl: CLIENT_UPLOAD_HANDLE_URL,
          clientPayload,
          contentType: file.type ? file.type : "application/octet-stream",
          onUploadProgress: ({ loaded, total, percentage }) => {
            if (totalBytes <= 0) {
              options.onProgress(null);
              return;
            }
            const slice = total > 0 ? (file.size * loaded) / total : (file.size * percentage) / 100;
            const pct = Math.min(100, Math.round(((doneBytes + slice) / totalBytes) * 100));
            options.onProgress(pct);
          },
        });
        blobUrl = uploaded.url;
        break;
      } catch (e) {
        const retryable = isTransientBlobNetworkError(e) && attempt < BLOB_UPLOAD_MAX_ATTEMPTS;
        if (!retryable) {
          return { ok: false, error: userFacingUploadError(e) };
        }
        options.onProgress(null);
        const waitMs = Math.min(
          BLOB_UPLOAD_RETRY_MAX_MS,
          BLOB_UPLOAD_RETRY_BASE_MS * 2 ** (attempt - 1),
        );
        await delay(waitMs);
      }
    }

    if (!blobUrl) {
      return { ok: false, error: UPLOAD_FAILED_GENERIC };
    }

    const reg = await completeRegistration(completeUrl, {
      fileName: file.name,
      pathname,
      fileUrl: blobUrl,
      fileSize: file.size,
    });
    if (!reg.ok) return { ok: false, error: reg.error ?? UPLOAD_FAILED_GENERIC };

    doneBytes += file.size;
    options.onProgress(Math.min(100, Math.round((doneBytes / totalBytes) * 100)));
  }

  options.onProgress(100);
  return { ok: true };
}
