import { getBlobStoreAccess } from "@/lib/blob-access";
import { isLikelyVercelBlobUrl } from "@/lib/blob-url-utils";

/** Use for `<a href>` and `<img src>` when blobs may be private. */
export function attachmentBlobHref(fileUrl: string): string {
  if (getBlobStoreAccess() === "private" && isLikelyVercelBlobUrl(fileUrl)) {
    return `/api/blob/media?url=${encodeURIComponent(fileUrl)}`;
  }
  return fileUrl;
}
