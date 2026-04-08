import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  isBrowserOnVercelDeployment,
  isHostedVercelProductionOrPreview,
  maxIssueUploadBytesForRuntime,
  multipartTooLargeHint,
  perFileExceedsMultipartRouteLimitMessage,
  vercelBlobRequiredMessage,
} from "@/lib/issue-upload-limits";
import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

export async function isBlobClientUploadEnabled(): Promise<boolean> {
  try {
    const r = await fetch("/api/blob/status", { credentials: "include", cache: "no-store" });
    const d = r.ok ? ((await r.json()) as { enabled?: boolean }) : { enabled: false };
    return Boolean(d.enabled);
  } catch {
    return false;
  }
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
 * Browser uploads always go to our API via multipart FormData; routes use server-side `put()` when Blob is configured.
 *
 * We do **not** use `@vercel/blob/client` `put()` here: it calls `https://vercel.com/api/blob`, which omits
 * `Access-Control-Allow-Origin` for custom domains (e.g. tracker.example.com), so uploads fail with CORS.
 */
export async function resolveBlobVsMultipartUpload(): Promise<
  { useBlob: true } | { useBlob: false } | { error: string }
> {
  if (isHostedVercelProductionOrPreview() && !(await isBlobClientUploadEnabled())) {
    return { error: vercelBlobRequiredMessage() };
  }
  return { useBlob: false };
}
