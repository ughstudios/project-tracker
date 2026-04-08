import { promises as fs } from "node:fs";
import path from "node:path";

/** Absolute path under public/, or null if URL is not under this project's uploads folder. */
export function diskPathForProjectUpload(fileUrl: string, projectId: string): string | null {
  const trimmed = fileUrl.replace(/^\/+/, "");
  const prefix = `uploads/projects/${projectId}/`;
  if (!trimmed.startsWith(prefix)) return null;
  const resolved = path.join(process.cwd(), "public", trimmed);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "projects", projectId);
  const rel = path.relative(uploadsRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

export async function removeProjectUploadFileIfPresent(
  fileUrl: string,
  projectId: string,
): Promise<void> {
  const abs = diskPathForProjectUpload(fileUrl, projectId);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch {
    // ignore missing file
  }
}
