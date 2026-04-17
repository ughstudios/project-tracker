import type { Locale } from "@/i18n/types";
import { detectIssueContentLanguage } from "@/lib/issue-content-translation";
import { getLocalizedText } from "@/lib/translated-content";

export type IssueTranslationFields = {
  title: string;
  titleTranslated: string | null;
  symptom: string;
  symptomTranslated: string | null;
  cause: string;
  causeTranslated: string | null;
  solution: string;
  solutionTranslated: string | null;
  contentLanguage: string | null;
};

/**
 * True when the UI locale expects translated text but stored `*Translated` fields
 * are missing or unusable, while the issue body is predominantly in another language.
 */
export function issueNeedsDisplayTranslationBackfill(
  issue: IssueTranslationFields,
  locale: Locale,
): boolean {
  const titleView = getLocalizedText({
    original: issue.title,
    translated: issue.titleTranslated,
    sourceLanguage: issue.contentLanguage,
    locale,
  });
  if (titleView.usedTranslation) return false;

  const detected = detectIssueContentLanguage([
    issue.title,
    issue.symptom,
    issue.cause,
    issue.solution,
  ]);
  if (!detected) return false;
  return detected !== locale;
}
