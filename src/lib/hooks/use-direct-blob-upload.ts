"use client";

import { useEffect, useState } from "react";

/** Whether direct browser uploads to Vercel Blob are available (Blob store connected). */
export function useDirectBlobUpload(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/blob/status", { credentials: "include", cache: "no-store" });
        const data = r.ok ? ((await r.json()) as { enabled?: boolean }) : { enabled: false };
        if (!cancelled) setEnabled(Boolean(data.enabled));
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
