import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  isBrowserOnVercelDeployment,
  isHostedVercelProductionOrPreview,
  maxClientBlobUploadBytes,
  maxIssueUploadBytesForRuntime,
  multipartTooLargeHint,
  perFileExceedsBlobProductLimitMessage,
  perFileExceedsMultipartRouteLimitMessage,
  vercelBlobRequiredMessage,
} from "@/lib/issue-upload-limits";
import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

function browserContentTypeForFile(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
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

export type BlobTokenExtras =
  | { scope: "project"; projectId: string }
  | { scope: "customer"; customerId: string }
  | { scope: "issue"; issueId: string }
  | { scope: "thread"; issueId: string; threadEntryId: string };

/** Resolve at upload time so we never pick multipart (4 MB cap on Vercel) while Blob is still “loading” in UI state. */
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

/** Multipart form uploads on Vercel are capped smaller than direct Blob; use this when not using Blob. */
export function validateFilesBeforeMultipartUpload(files: File[]): string | null {
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per upload.`;
  }
  const cap = maxIssueUploadBytesForRuntime();
  const sum = files.reduce((s, f) => s + f.size, 0);
  /** Server checks total body size (`vercelMultipartPayloadTooLargeResponse`); mirror that on the client. */
  if (cap <= VERCEL_SERVER_MULTIPART_BUDGET_BYTES && sum > VERCEL_SERVER_MULTIPART_BUDGET_BYTES) {
    return isBrowserOnVercelDeployment() ? multipartTooLargeHint() : "Total upload size is too large for one request.";
  }
  for (const f of files) {
    if (f.size > cap) {
      return isBrowserOnVercelDeployment()
        ? multipartTooLargeHint()
        : perFileExceedsMultipartRouteLimitMessage(cap);
    }
  }
  return null;
}

/**
 * Blob when configured; never use fragile multipart on hosted prod/preview without Blob.
 */
export async function resolveBlobVsMultipartUpload(): Promise<
  { useBlob: true } | { useBlob: false } | { error: string }
> {
  if (await isBlobClientUploadEnabled()) return { useBlob: true };
  if (isHostedVercelProductionOrPreview()) return { error: vercelBlobRequiredMessage() };
  return { useBlob: false };
}

type TokenResponse = { clientToken: string; pathname: string };

async function fetchBlobToken(
  extras: BlobTokenExtras,
  file: File,
): Promise<{ ok: true; data: TokenResponse } | { ok: false; error: string }> {
  const res = await fetch("/api/blob/client-token", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...extras,
      fileName: file.name,
      fileSize: file.size,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as { error?: string } & Partial<TokenResponse>;
  if (!res.ok) {
    return { ok: false, error: raw.error ?? "Could not start upload." };
  }
  if (!raw.clientToken || !raw.pathname) {
    return { ok: false, error: "Invalid token response." };
  }
  return { ok: true, data: { clientToken: raw.clientToken, pathname: raw.pathname } };
}

const BLOB_PUT_MAX_ATTEMPTS = 5;
const BLOB_PUT_RETRY_BASE_MS = 1_200;
const BLOB_PUT_RETRY_MAX_MS = 12_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chrome often surfaces ERR_NETWORK_CHANGED as TypeError: Failed to fetch. */
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

/**
 * Upload files via Vercel Blob from the browser, then register each with `completeUrl`.
 * `onProgress` receives approximate overall percent (0–100) or `null` if indeterminate.
 */
export async function uploadFilesViaBlobClient(options: {
  files: File[];
  tokenExtras: BlobTokenExtras;
  completeUrl: string;
  onProgress: (percent: number | null) => void;
}): Promise<{ ok: boolean; error?: string }> {
  const { files, tokenExtras, completeUrl } = options;
  const pre = validateFilesBeforeUpload(files);
  if (pre) return { ok: false, error: pre };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  let doneBytes = 0;
  const { put } = await import("@vercel/blob/client");

  for (const file of files) {
    let blobUrl: string | undefined;
    let pathnameUsed: string | undefined;

    for (let attempt = 1; attempt <= BLOB_PUT_MAX_ATTEMPTS; attempt++) {
      const tok = await fetchBlobToken(tokenExtras, file);
      if (!tok.ok) return { ok: false, error: tok.error };

      try {
        // Never use `multipart: true` here: it POSTs to `vercel.com/api/blob/mpu`, which does not
        // send Access-Control-Allow-Origin for custom domains (e.g. tracker.*). Single PUT works
        // from the app origin for large files (100 MB cap) without that CORS trap.
        const uploaded = await put(tok.data.pathname, file, {
          access: "public",
          token: tok.data.clientToken,
          contentType: browserContentTypeForFile(file),
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
        pathnameUsed = tok.data.pathname;
        break;
      } catch (e) {
        const retryable = isTransientBlobNetworkError(e) && attempt < BLOB_PUT_MAX_ATTEMPTS;
        if (!retryable) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            ok: false,
            error:
              msg && msg !== "undefined"
                ? `Upload failed: ${msg}`
                : "Upload failed. Check your connection and try again.",
          };
        }
        options.onProgress(null);
        const waitMs = Math.min(
          BLOB_PUT_RETRY_MAX_MS,
          BLOB_PUT_RETRY_BASE_MS * 2 ** (attempt - 1),
        );
        await delay(waitMs);
      }
    }

    if (!blobUrl || !pathnameUsed) {
      return {
        ok: false,
        error:
          "Upload failed after several retries. Your connection may be unstable—try again on Wi‑Fi or wait a moment.",
      };
    }

    const reg = await completeRegistration(completeUrl, {
      fileName: file.name,
      pathname: pathnameUsed,
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
