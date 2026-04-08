import { VERCEL_SERVER_MULTIPART_BUDGET_BYTES } from "@/lib/vercel-upload-budget";

export const ISSUE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const ISSUE_UPLOAD_MAX_FILES_PER_POST = 20;

/** Browser → Vercel Blob uploads bypass the serverless request body limit; use the product cap. */
export function maxClientBlobUploadBytes(): number {
  return ISSUE_UPLOAD_MAX_BYTES;
}

/** Per-file cap: on Vercel, single request body limit applies for multipart server routes. */
export function maxIssueUploadBytesForRuntime(): number {
  if (process.env.VERCEL === "1") {
    return Math.min(ISSUE_UPLOAD_MAX_BYTES, VERCEL_SERVER_MULTIPART_BUDGET_BYTES);
  }
  return ISSUE_UPLOAD_MAX_BYTES;
}
