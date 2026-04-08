import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

export const ISSUE_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
export const ISSUE_UPLOAD_MAX_FILES_PER_POST = 20;

const MB = 1024 * 1024;

export function uploadMaxPerFileMb(): number {
  return Math.floor(ISSUE_UPLOAD_MAX_BYTES / MB);
}

/** Multipart / request-body uploads: low cap on Vercel vs Blob browser uploads. */
export function perFileExceedsMultipartRouteLimitMessage(limitBytes: number): string {
  const limMb = Math.max(1, Math.ceil(limitBytes / MB));
  const maxMb = uploadMaxPerFileMb();
  return (
    `A file exceeds the ${limMb} MB per-file limit for uploads that go through the server in this environment. ` +
    `Connect Vercel Blob (Storage → link store, set BLOB_READ_WRITE_TOKEN) so files upload directly to storage—up to ${maxMb} MB each—or use a smaller file.`
  );
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
  return `Files over about ${Math.floor(VERCEL_SERVER_MULTIPART_BUDGET_BYTES / (1024 * 1024))} MB must upload via Vercel Blob on this deployment. In Vercel: Project → Storage → connect a Blob store so BLOB_READ_WRITE_TOKEN is set, then redeploy.`;
}

/** Production or Preview on Vercel (not `vercel dev`’s `development`). */
export function isHostedVercelProductionOrPreview(): boolean {
  const e = process.env.NEXT_PUBLIC_VERCEL_ENV;
  return e === "production" || e === "preview";
}

export function vercelBlobRequiredMessage(): string {
  return "This deployment requires Vercel Blob for file uploads. In Vercel: Project → Storage → connect a Blob store, add BLOB_READ_WRITE_TOKEN for Production (and Preview if you use it), then redeploy.";
}
