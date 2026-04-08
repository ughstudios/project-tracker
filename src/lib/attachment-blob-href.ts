import { getBlobStoreAccess } from "@/lib/blob-access";
import { isLikelyVercelBlobUrl } from "@/lib/blob-url-utils";

export type AttachmentBlobHrefOptions = {
  /** Use `download=1` so `Content-Disposition: attachment` and the real file name apply. */
  asDownload?: boolean;
};

/** Use for `<a href>` and `<img src>` when blobs may be private. */
export function attachmentBlobHref(fileUrl: string, options?: AttachmentBlobHrefOptions): string {
  if (getBlobStoreAccess() === "private" && isLikelyVercelBlobUrl(fileUrl)) {
    let path = `/api/blob/media?url=${encodeURIComponent(fileUrl)}`;
    if (options?.asDownload) path += "&download=1";
    return path;
  }
  return fileUrl;
}
