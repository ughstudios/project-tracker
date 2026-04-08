import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

export const ISSUE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const ISSUE_UPLOAD_MAX_FILES_PER_POST = 20;

/**
 * True when the **browser** build is running on a Vercel deployment.
 * `VERCEL=1` is server-only and is **undefined** in client bundles — use this for upload UI limits.
 */
export function isBrowserOnVercelDeployment(): boolean {
  const e = process.env.NEXT_PUBLIC_VERCEL_ENV;
  return e === "production" || e === "preview" || e === "development";
}

/** Browser → Vercel Blob uploads bypass the serverless request body limit; use the product cap. */
export function maxClientBlobUploadBytes(): number {
  return ISSUE_UPLOAD_MAX_BYTES;
}

/** Per-file cap for **multipart uploads through API routes** (~4.5 MB body on Vercel serverless). */
export function maxIssueUploadBytesForRuntime(): number {
  if (process.env.VERCEL === "1" || isBrowserOnVercelDeployment()) {
    return Math.min(ISSUE_UPLOAD_MAX_BYTES, VERCEL_SERVER_MULTIPART_BUDGET_BYTES);
  }
  return ISSUE_UPLOAD_MAX_BYTES;
}

export function multipartTooLargeHint(): string {
  return `Files over about ${Math.floor(VERCEL_SERVER_MULTIPART_BUDGET_BYTES / (1024 * 1024))} MB must upload via Vercel Blob on this deployment. In Vercel: Project → Storage → connect a Blob store so BLOB_READ_WRITE_TOKEN is set, then redeploy.`;
}
