import { del } from "@vercel/blob";
import { getBlobReadWriteToken } from "@/lib/file-storage";

const blobAuthHeaders = (token: string): { authorization: string } => ({
  authorization: `Bearer ${token}`,
});

/** ReadableStream of all part bodies in order (bounded memory: one network chunk at a time). */
export function mergedReadableStreamFromRelayPartUrls(
  partUrls: string[],
  token: string,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const url of partUrls) {
          const res = await fetch(url, {
            headers: blobAuthHeaders(token),
            cache: "no-store",
          });
          if (!res.ok) {
            throw new Error(`Staging part fetch failed (${res.status}).`);
          }
          if (!res.body) {
            throw new Error("Staging part has no body.");
          }
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
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
  const chunks: Buffer[] = [];
  for (const url of partUrls) {
    const res = await fetch(url, {
      headers: blobAuthHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Staging part fetch failed (${res.status}).`);
    }
    chunks.push(Buffer.from(await res.arrayBuffer()));
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
