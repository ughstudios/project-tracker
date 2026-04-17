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
