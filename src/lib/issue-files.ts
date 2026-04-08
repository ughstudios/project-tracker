import {
  deleteBlobUrlIfPresent,
  shouldSkipLocalDelete,
} from "@/lib/file-storage";
import { promises as fs } from "node:fs";
import path from "node:path";

export {
  ISSUE_UPLOAD_MAX_BYTES,
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  maxClientBlobUploadBytes,
  maxIssueUploadBytesForRuntime,
} from "@/lib/issue-upload-limits";

export function storedFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${stamp}-${base || "file"}${ext}`;
}

/** Absolute path under public/, or null if URL is not under this issue's uploads folder. */
export function diskPathForIssueUpload(fileUrl: string, issueId: string): string | null {
  const trimmed = fileUrl.replace(/^\/+/, "");
  const prefix = `uploads/issues/${issueId}/`;
  if (!trimmed.startsWith(prefix)) return null;
  const resolved = path.join(process.cwd(), "public", trimmed);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "issues", issueId);
  const rel = path.relative(uploadsRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

export async function removeUploadFileIfPresent(fileUrl: string, issueId: string): Promise<void> {
  await deleteBlobUrlIfPresent(fileUrl);
  if (shouldSkipLocalDelete(fileUrl)) return;
  const abs = diskPathForIssueUpload(fileUrl, issueId);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch {
    // ignore missing file
  }
}
