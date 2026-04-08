import type { BlobAccessType } from "@vercel/blob";

/**
 * Must match the Vercel Blob **store** access (Dashboard → Storage → store).
 * Defaults to **private** (typical Vercel store). Set `NEXT_PUBLIC_BLOB_STORE_ACCESS=public`
 * and `BLOB_STORE_ACCESS=public` only if the store is public and you want direct blob URLs in the UI.
 */
export function getBlobStoreAccess(): BlobAccessType {
  const raw =
    process.env.NEXT_PUBLIC_BLOB_STORE_ACCESS?.trim() ??
    process.env.BLOB_STORE_ACCESS?.trim() ??
    "";
  if (raw.toLowerCase() === "public") return "public";
  return "private";
}

export function isPrivateBlobStore(): boolean {
  return getBlobStoreAccess() === "private";
}
