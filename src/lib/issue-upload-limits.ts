import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

export const ISSUE_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
export const ISSUE_UPLOAD_MAX_FILES_PER_POST = 20;

const MB = 1024 * 1024;

/** Steps to link Blob (shown with size-limit errors and when uploads are blocked). */
export const VERCEL_BLOB_CONNECT_AND_REDEPLOY_STEPS =
  "In Vercel: Project → Storage → connect a Blob store so BLOB_READ_WRITE_TOKEN is set, then redeploy.";

/** Shared copy when uploads hit the ~4 MB serverless request budget on Vercel. */
export const VERCEL_BLOB_SETUP_AND_REDEPLOY_MESSAGE = `Files over about 4 MB must upload via Vercel Blob on this deployment. ${VERCEL_BLOB_CONNECT_AND_REDEPLOY_STEPS}`;

export function uploadMaxPerFileMb(): number {
  return Math.floor(ISSUE_UPLOAD_MAX_BYTES / MB);
}

/** Multipart / request-body uploads: low cap on Vercel vs Blob browser uploads. */
export function perFileExceedsMultipartRouteLimitMessage(limitBytes: number): string {
  const limMb = Math.max(1, Math.ceil(limitBytes / MB));
  return `A file exceeds the about ${limMb} MB limit for a single request on this deployment. ${VERCEL_BLOB_SETUP_AND_REDEPLOY_MESSAGE} You can also use a smaller file or split the upload.`;
}

/** Client Blob + product cap (token + complete routes). */
export function perFileExceedsBlobProductLimitMessage(): string {
  const maxMb = uploadMaxPerFileMb();
  return `This file is larger than the ${maxMb} MB per-file maximum. Compress it, shorten or re-export the video, or split into smaller parts.`;
}

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
  return VERCEL_BLOB_SETUP_AND_REDEPLOY_MESSAGE;
}

/** Production or Preview on Vercel (not `vercel dev`’s `development`). */
export function isHostedVercelProductionOrPreview(): boolean {
  const e = process.env.NEXT_PUBLIC_VERCEL_ENV;
  return e === "production" || e === "preview";
}

export function vercelBlobRequiredMessage(): string {
  return `File uploads require Vercel Blob on this deployment. ${VERCEL_BLOB_CONNECT_AND_REDEPLOY_STEPS}`;
}
