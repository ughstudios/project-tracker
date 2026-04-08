import { isSafeStoredObjectKeyTail } from "@/lib/blob-upload-auth";

/** Parsed path `work-records/{userId}/{fileName}` from a Vercel Blob URL. */
export function parseWorkRecordBlobPathFromUrl(
  blobUrl: string,
): { ownerUserId: string; fileName: string } | null {
  try {
    const u = new URL(blobUrl);
    let path = u.pathname.replace(/^\/+/, "");
    try {
      path = decodeURIComponent(path.replace(/\+/g, "%20"));
    } catch {
      return null;
    }
    const prefix = "work-records/";
    if (!path.startsWith(prefix)) return null;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    const ownerUserId = rest.slice(0, slash);
    const fileName = rest.slice(slash + 1);
    if (!ownerUserId || ownerUserId.includes("/") || ownerUserId.includes("..")) return null;
    if (!fileName || fileName.includes("/") || !isSafeStoredObjectKeyTail(fileName)) return null;
    return { ownerUserId, fileName };
  } catch {
    return null;
  }
}
