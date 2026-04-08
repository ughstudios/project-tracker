/** Verify a public Blob URL points at the same path we issued for upload (prevents registering arbitrary URLs). */
export function blobPublicUrlMatchesPathname(fileUrl: string, pathname: string): boolean {
  try {
    const u = new URL(fileUrl);
    if (!u.hostname.includes("blob.vercel-storage.com")) return false;
    const normalizedPathname = pathname.replace(/^\/+/, "");
    let urlPath = u.pathname.replace(/^\/+/, "");
    try {
      urlPath = decodeURIComponent(urlPath.replace(/\+/g, "%20"));
    } catch {
      return false;
    }
    return urlPath === normalizedPathname;
  } catch {
    return false;
  }
}
