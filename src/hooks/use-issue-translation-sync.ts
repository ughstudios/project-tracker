"use client";

import type { Locale } from "@/i18n/types";
import { issueNeedsDisplayTranslationBackfill } from "@/lib/issue-translation-display";
import { useEffect, useRef } from "react";

type IssueLike = Parameters<typeof issueNeedsDisplayTranslationBackfill>[0] & { id: string };

/**
 * After lists load, fills missing EN/ZH translations via API and merges into local state.
 * DB row is updated (cached); other clients see it on next fetch.
 */
export function useIssueTranslationSync<T extends IssueLike>(
  issues: readonly T[],
  setIssues: React.Dispatch<React.SetStateAction<T[]>>,
  locale: Locale,
  enabled: boolean,
) {
  const syncedIds = useRef(new Set<string>());
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    if (!enabled || issues.length === 0) return;

    const loc = localeRef.current;
    const candidates = issues.filter(
      (i) => !syncedIds.current.has(i.id) && issueNeedsDisplayTranslationBackfill(i, loc),
    );
    if (candidates.length === 0) return;

    const issueIds = candidates.map((i) => i.id).slice(0, 20);

    let cancelled = false;
    void (async () => {
      const chunkSize = 8;
      for (let i = 0; i < issueIds.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = issueIds.slice(i, i + chunkSize);
        try {
          const res = await fetch("/api/issues/sync-translations", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueIds: chunk }),
          });
          if (!res.ok) continue;
          const data = (await res.json()) as {
            updates?: IssueLike[];
            configured?: boolean;
          };
          if (data.configured === false) return;
          for (const id of chunk) syncedIds.current.add(id);
          if (cancelled) return;
          const updates = data.updates ?? [];
          if (updates.length > 0) {
            setIssues((prev) =>
              prev.map((row) => {
                const u = updates.find((x) => x.id === row.id);
                return u ? ({ ...row, ...u } as T) : row;
              }),
            );
          }
        } catch {
          /* retry on a later effect if needed */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [issues, enabled, setIssues, locale]);
}
