import type { ContentLanguage } from "@/lib/translated-content";

const CHINESE_RE = /\p{Script=Han}/gu;
const ENGLISH_RE = /[A-Za-z]/g;

function countMatches(text: string, re: RegExp) {
  return text.match(re)?.length ?? 0;
}

/** Dominant language of the combined issue text (title + fields), for EN/CH display routing. */
export function detectIssueContentLanguage(values: string[]): ContentLanguage | null {
  const joined = values.join(" ").trim();
  if (!joined) return null;

  const chineseCount = countMatches(joined, CHINESE_RE);
  const englishCount = countMatches(joined, ENGLISH_RE);

  if (chineseCount === 0 && englishCount === 0) return null;
  if (chineseCount === 0) return "en";
  if (englishCount === 0) return "zh";

  return chineseCount >= englishCount ? "zh" : "en";
}

/**
 * Language hint for “should we request a missing translation?”.
 * When the title contains CJK, prefer title-only detection so a long English symptom
 * does not drown out a Chinese title (which previously skipped backfill entirely).
 */
export function detectIssueContentLanguageForBackfill(issue: {
  title: string;
  symptom: string;
  cause: string;
  solution: string;
}): ContentLanguage | null {
  const t = issue.title.trim();
  if (t && /\p{Script=Han}/u.test(t)) {
    const titleOnly = detectIssueContentLanguage([issue.title]);
    if (titleOnly) return titleOnly;
  }
  return detectIssueContentLanguage([
    issue.title,
    issue.symptom,
    issue.cause,
    issue.solution,
  ]);
}
