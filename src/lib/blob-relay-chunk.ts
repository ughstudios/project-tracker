/** Under Vercel’s ~4.5 MB request cap (leave margin for headers). */
export const BLOB_RELAY_CHUNK_BYTES = 3 * 1024 * 1024;

/** Staging object next to the final pathname: `{dir}relay-{sessionId}-{seq}` */
export function relayStagingPathname(finalPathname: string, sessionId: string, seq: number): string {
  const i = finalPathname.lastIndexOf("/");
  const dir = i >= 0 ? finalPathname.slice(0, i + 1) : "";
  return `${dir}relay-${sessionId}-${seq}`;
}
