/** Pure string check — safe for client bundles (no Node APIs). */

export function isLikelyVercelBlobUrl(fileUrl: string): boolean {
  return fileUrl.includes("blob.vercel-storage.com");
}
