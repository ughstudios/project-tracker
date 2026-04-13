"use client";

import { attachmentBlobHref } from "@/lib/attachment-blob-href";
import { isLikelyVercelBlobUrl } from "@/lib/blob-url-utils";

type Segment = { kind: "text"; text: string } | { kind: "img"; alt: string; url: string };

function segmentContent(content: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const re = /!\[([^\]]*)\]\((https:\/\/[^)\s]+|http:\/\/[^)\s]+)\)/g;
  for (const m of content.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      out.push({ kind: "text", text: content.slice(last, idx) });
    }
    out.push({ kind: "img", alt: m[1], url: m[2] });
    last = idx + m[0].length;
  }
  if (last < content.length) {
    out.push({ kind: "text", text: content.slice(last) });
  }
  return out;
}

export function WorkRecordContentView({ content }: { content: string }) {
  const segments = segmentContent(content);
  return (
    <div className="space-y-1 break-words">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i} className="whitespace-pre-wrap">
            {seg.text}
          </span>
        ) : (
          <span key={i} className="my-1 block">
            {isLikelyVercelBlobUrl(seg.url) ? (
              <a
                href={attachmentBlobHref(seg.url)}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachmentBlobHref(seg.url)}
                  alt={seg.alt || "Pasted image"}
                  className="max-h-56 max-w-full rounded border border-zinc-200 dark:border-zinc-700 object-contain"
                />
              </a>
            ) : (
              <a
                href={seg.url}
                className="link-accent underline"
                target="_blank"
                rel="noreferrer"
              >
                {seg.alt || seg.url}
              </a>
            )}
          </span>
        ),
      )}
    </div>
  );
}
