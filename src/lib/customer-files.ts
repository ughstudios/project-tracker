import { promises as fs } from "node:fs";
import path from "node:path";

/** Absolute path under public/, or null if URL is not under this customer's uploads folder. */
export function diskPathForCustomerUpload(fileUrl: string, customerId: string): string | null {
  const trimmed = fileUrl.replace(/^\/+/, "");
  const prefix = `uploads/customers/${customerId}/`;
  if (!trimmed.startsWith(prefix)) return null;
  const resolved = path.join(process.cwd(), "public", trimmed);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "customers", customerId);
  const rel = path.relative(uploadsRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

export async function removeCustomerUploadFileIfPresent(
  fileUrl: string,
  customerId: string,
): Promise<void> {
  const abs = diskPathForCustomerUpload(fileUrl, customerId);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch {
    // ignore missing file
  }
}
