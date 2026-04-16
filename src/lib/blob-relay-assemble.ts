import { del, get } from "@vercel/blob";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { getBlobReadWriteToken } from "@/lib/file-storage";

/** ReadableStream of all part bodies in order (bounded memory: one network chunk at a time). */
export function mergedReadableStreamFromRelayPartUrls(
  partUrls: string[],
  token: string,
): ReadableStream<Uint8Array> {
  const access = getBlobStoreAccess();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const url of partUrls) {
          const result = await get(url, { access, token, useCache: false });
          if (!result || result.statusCode !== 200 || !result.stream) {
            throw new Error("Staging part read failed.");
          }
          const reader = result.stream.getReader();
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value && value.byteLength) {
                // Copy: undici may reuse buffers; put() may read asynchronously.
                controller.enqueue(new Uint8Array(value));
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e instanceof Error ? e : new Error("Staging assemble failed."));
      }
    },
  });
}

/** Load all parts into one buffer (HEIC conversion needs a full file; keep for smaller images). */
export async function bufferFromRelayPartUrls(partUrls: string[], token: string): Promise<Buffer> {
  const access = getBlobStoreAccess();
  const chunks: Buffer[] = [];
  for (const url of partUrls) {
    const result = await get(url, { access, token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Staging part read failed.");
    }
    const reader = result.stream.getReader();
    const partChunks: Buffer[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength) partChunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    chunks.push(Buffer.concat(partChunks));
  }
  return Buffer.concat(chunks);
}

export async function deleteRelayStagingBlobUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const token = getBlobReadWriteToken();
  if (!token) return;
  try {
    await del(urls, { token });
  } catch {
    for (const url of urls) {
      try {
        await del(url, { token });
      } catch {
        /* ignore */
      }
    }
  }
}
