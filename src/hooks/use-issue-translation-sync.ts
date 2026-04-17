"use client";

import type { Locale } from "@/i18n/types";
import { issueNeedsDisplayTranslationBackfill } from "@/lib/issue-translation-display";
import { useEffect, useRef, useState } from "react";

type IssueLike = Parameters<typeof issueNeedsDisplayTranslationBackfill>[0] & { id: string };

const CHUNK_SIZE = 8;
const MAX_SYNC_ATTEMPTS_PER_ISSUE = 5;

/**
 * After lists load, fills missing EN/ZH translations via API and merges into local state.
 * DB row is updated (cached); other clients see it on the next fetch.
 *
 * @param refetch — optional reload from GET /api/issues so the UI matches DB after writes
 *                  (and so a second pass can run when the server only updated `contentLanguage` first).
 */
export function useIssueTranslationSync<T extends IssueLike>(
  issues: readonly T[],
  setIssues: React.Dispatch<React.SetStateAction<T[]>>,
  locale: Locale,
  enabled: boolean,
  refetch?: () => void | Promise<void>,
) {
  const syncedIds = useRef(new Set<string>());
  const attemptsById = useRef(new Map<string, number>());
  const translationUnavailableRef = useRef(false);
  const localeRef = useRef(locale);
  const prevLocaleRef = useRef(locale);
  /** Retries the effect when the server returned no row patches (e.g. second pass after contentLanguage-only write). */
  const [syncPass, setSyncPass] = useState(0);
  localeRef.current = locale;

  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      syncedIds.current.clear();
      attemptsById.current.clear();
      translationUnavailableRef.current = false;
      prevLocaleRef.current = locale;
      setSyncPass(0);
    }

    if (!enabled || issues.length === 0 || translationUnavailableRef.current) return;

    const loc = localeRef.current;
    const candidates = issues.filter((i) => {
      if (syncedIds.current.has(i.id)) return false;
      if ((attemptsById.current.get(i.id) ?? 0) >= MAX_SYNC_ATTEMPTS_PER_ISSUE) return false;
      return issueNeedsDisplayTranslationBackfill(i, loc);
    });
    if (candidates.length === 0) return;

    const issueIds = candidates.map((i) => i.id).slice(0, 20);

    let cancelled = false;
    void (async () => {
      let mergedUpdateCount = 0;
      let ranConfiguredSync = false;
      for (let i = 0; i < issueIds.length; i += CHUNK_SIZE) {
        if (cancelled) return;
        const chunk = issueIds.slice(i, i + CHUNK_SIZE);
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
          if (data.configured === false) {
            translationUnavailableRef.current = true;
            return;
          }
          ranConfiguredSync = true;

          const updates = data.updates ?? [];
          for (const u of updates) {
            syncedIds.current.add(u.id);
            attemptsById.current.delete(u.id);
          }

          const updatedIdSet = new Set(updates.map((u) => u.id));
          for (const id of chunk) {
            if (!updatedIdSet.has(id)) {
              attemptsById.current.set(id, (attemptsById.current.get(id) ?? 0) + 1);
            }
          }

          if (cancelled) return;
          if (updates.length > 0) {
            mergedUpdateCount += updates.length;
            setIssues((prev) =>
              prev.map((row) => {
                const u = updates.find((x) => x.id === row.id);
                return u ? ({ ...row, ...u } as T) : row;
              }),
            );
          }
        } catch {
          for (const id of chunk) {
            attemptsById.current.set(id, (attemptsById.current.get(id) ?? 0) + 1);
          }
        }
      }

      if (!cancelled && refetch && mergedUpdateCount > 0) {
        await refetch();
      }

      if (
        !cancelled &&
        ranConfiguredSync &&
        mergedUpdateCount === 0 &&
        !translationUnavailableRef.current
      ) {
        const stillNeed = issueIds.some(
          (id) =>
            !syncedIds.current.has(id) &&
            (attemptsById.current.get(id) ?? 0) < MAX_SYNC_ATTEMPTS_PER_ISSUE,
        );
        if (stillNeed) setSyncPass((p) => p + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [issues, enabled, setIssues, locale, refetch, syncPass]);
}
