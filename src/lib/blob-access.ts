import type { BlobAccessType } from "@vercel/blob";

/**
 * Must match the Vercel Blob **store** access (Dashboard → Storage → store).
 * - `public` — direct `fileUrl` works in the browser (default).
 * - `private` — uploads use private access; use `/api/blob/media` for viewing (see `attachmentBlobHref`).
 */
export function getBlobStoreAccess(): BlobAccessType {
  const raw =
    process.env.NEXT_PUBLIC_BLOB_STORE_ACCESS?.trim() ??
    process.env.BLOB_STORE_ACCESS?.trim() ??
    "";
  return raw.toLowerCase() === "private" ? "private" : "public";
}

export function isPrivateBlobStore(): boolean {
  return getBlobStoreAccess() === "private";
}
