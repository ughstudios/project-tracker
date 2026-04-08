import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  isBrowserOnVercelDeployment,
  isHostedVercelProductionOrPreview,
  maxClientBlobUploadBytes,
  multipartTooLargeHint,
  perFileExceedsBlobProductLimitMessage,
  vercelBlobRequiredMessage,
  vercelLargeFileBlockedOnCustomDomainMessage,
} from "@/lib/issue-upload-limits";
import { storedFileName } from "@/lib/stored-file-name";
import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

const CLIENT_UPLOAD_HANDLE_URL = "/api/blob/client-upload";

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

function payloadExceedsServerlessMultipartBudget(files: File[]): boolean {
  const sum = files.reduce((s, f) => s + f.size, 0);
  return (
    sum > VERCEL_SERVER_MULTIPART_BUDGET_BYTES ||
    files.some((f) => f.size > VERCEL_SERVER_MULTIPART_BUDGET_BYTES)
  );
}

/** Vercel’s browser Blob API allows `*.vercel.app` origins; custom domains get CORS-blocked for large bodies. */
export function hostnameAllowsVercelBlobBrowserPut(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.hostname.endsWith(".vercel.app");
}

/**
 * Ensures Vercel Blob client uploads can run (token exchange + browser → Blob).
 * File bytes never go through our API routes except for the small `handleUpload` JSON exchange.
 */
export async function assertClientBlobUploadsReady(
  files: File[],
): Promise<{ ok: true } | { error: string }> {
  if (!(await isBlobClientUploadEnabled())) {
    return { error: vercelBlobRequiredMessage() };
  }
  const pre = validateFilesBeforeUpload(files);
  if (pre) return { error: pre };
  if (
    isHostedVercelProductionOrPreview() &&
    payloadExceedsServerlessMultipartBudget(files) &&
    !hostnameAllowsVercelBlobBrowserPut()
  ) {
    return { error: vercelLargeFileBlockedOnCustomDomainMessage() };
  }
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
    return { ok: false, error: raw.error ?? "Could not save attachment." };
  }
  return { ok: true };
}

const BLOB_UPLOAD_MAX_ATTEMPTS = 5;
const BLOB_UPLOAD_RETRY_BASE_MS = 1_200;
const BLOB_UPLOAD_RETRY_MAX_MS = 12_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isLikelyCorsOrBlockedBlobError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("cors") || msg.includes("access-control") || msg.includes("network");
}

/** Shown when browser → Vercel Blob fails on some custom domains (Vercel CORS policy). */
export function vercelBlobClientCorsHint(): string {
  return (
    " If you are on a custom domain, try the .vercel.app deployment URL for large uploads, " +
    "or keep each request under about 4 MB. (The file bytes must go to Vercel Blob in the browser, not through our API.)"
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
  const { upload } = await import("@vercel/blob/client");
  const prefix = blobPathPrefix(tokenExtras);

  for (const file of files) {
    const stored = storedFileName(file.name);
    const pathname = `${prefix}${stored}`;
    const clientPayload = JSON.stringify({
      ...tokenExtras,
      originalFileName: file.name,
    });

    let blobUrl: string | undefined;

    for (let attempt = 1; attempt <= BLOB_UPLOAD_MAX_ATTEMPTS; attempt++) {
      try {
        const uploaded = await upload(pathname, file, {
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
          const msg = e instanceof Error ? e.message : String(e);
          const base =
            msg && msg !== "undefined"
              ? `Upload failed: ${msg}`
              : "Upload failed. Check your connection and try again.";
          const hint = isLikelyCorsOrBlockedBlobError(e) ? vercelBlobClientCorsHint() : "";
          return { ok: false, error: base + hint };
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
      return {
        ok: false,
        error:
          "Upload failed after several retries. Your connection may be unstable—try again on Wi‑Fi or wait a moment." +
          vercelBlobClientCorsHint(),
      };
    }

    const reg = await completeRegistration(completeUrl, {
      fileName: file.name,
      pathname,
      fileUrl: blobUrl,
      fileSize: file.size,
    });
    if (!reg.ok) return { ok: false, error: reg.error };

    doneBytes += file.size;
    options.onProgress(Math.min(100, Math.round((doneBytes / totalBytes) * 100)));
  }

  options.onProgress(100);
  return { ok: true };
}
