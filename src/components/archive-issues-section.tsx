"use client";

import { useI18n } from "@/i18n/context";
import { getLocalizedText } from "@/lib/translated-content";
import Link from "next/link";
import { useMemo, useState } from "react";

export type ArchivedIssueListItem = {
  id: string;
  title: string;
  titleTranslated: string | null;
  status: string;
  archivedAt: string | null;
  symptom: string;
  symptomTranslated: string | null;
  cause: string;
  causeTranslated: string | null;
  solution: string;
  solutionTranslated: string | null;
  contentLanguage: string | null;
  rndContact: string;
  project: { name: string } | null;
  customer: { name: string } | null;
};

type Props = {
  issues: ArchivedIssueListItem[];
  staffAdmin: boolean;
  unarchiveAction: (formData: FormData) => Promise<void>;
};

export function ArchiveIssuesSection({ issues, staffAdmin, unarchiveAction }: Props) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((i) => {
      const haystack = [
        i.id,
        i.title,
        i.titleTranslated ?? "",
        i.status,
        i.symptom,
        i.symptomTranslated ?? "",
        i.cause,
        i.causeTranslated ?? "",
        i.solution,
        i.solutionTranslated ?? "",
        i.rndContact,
        i.project?.name ?? "",
        i.customer?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [issues, query]);

  if (issues.length === 0) {
    return (
      <>
        <h2 className="text-base font-semibold">{t("archive.issues")}</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("archive.noIssues")}</p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-base font-semibold">{t("archive.issues")}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("archive.issuesSearchHelp")}</p>
      <input
        className="input mt-3 w-full max-w-xl"
        placeholder={t("archive.issuesSearchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("archive.issuesSearchPlaceholder")}
      />
      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("archive.noIssuesMatchSearch")}</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {filtered.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">
                {(() => {
                  const localizedTitle = getLocalizedText({
                    original: i.title,
                    translated: i.titleTranslated,
                    sourceLanguage: i.contentLanguage,
                    locale,
                  });
                  return (
                    <>
                <Link
                  href={`/issues/${i.id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700"
                >
                  <span className="font-mono text-[11px] font-normal text-zinc-600 dark:text-zinc-400">{i.id}</span>
                  {" — "}
                  {localizedTitle.text}
                </Link>{" "}
                {localizedTitle.usedTranslation ? (
                  <span className="block text-xs text-sky-800 dark:text-sky-400/90">
                    {t("common.autoTranslatedFrom", {
                      language: t(`language.${localizedTitle.sourceLanguage ?? "en"}`),
                    })}
                  </span>
                ) : null}
                <span className="text-zinc-600 dark:text-zinc-400">
                  ({i.status}) —{" "}
                  {[i.project?.name, i.customer?.name].filter(Boolean).join(" · ") ||
                    t("issues.unlinked")}
                  {" — "}
                  {i.archivedAt ? new Date(i.archivedAt).toLocaleString() : ""}
                </span>
                    </>
                  );
                })()}
              </span>
              {staffAdmin ? (
                <form action={unarchiveAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button
                    type="submit"
                    className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800"
                  >
                    {t("common.unarchive")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
