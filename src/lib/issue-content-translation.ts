import type { Locale } from "@/i18n/types";
import {
  buildTranslationCacheKey,
  readTranslationCache,
  writeTranslationCache,
} from "@/lib/redis-translation-cache";
import { getOppositeLocale, type ContentLanguage } from "./translated-content";

type IssueTranslationInput = {
  title: string;
  symptom: string;
  cause: string;
  solution: string;
};

type IssueTranslationResult = {
  contentLanguage: ContentLanguage | null;
  titleTranslated: string | null;
  symptomTranslated: string | null;
  causeTranslated: string | null;
  solutionTranslated: string | null;
};

type ThreadTranslationResult = {
  contentLanguage: ContentLanguage | null;
  contentTranslated: string | null;
};

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

function getTranslationModel() {
  return process.env.OPENAI_TRANSLATION_MODEL?.trim() || "gpt-4o-mini";
}

function getOpenAiApiKey() {
  return process.env.AI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
}

export function isTranslationConfigured() {
  return Boolean(getOpenAiApiKey());
}

async function translateJson<T>({
  sourceLanguage,
  targetLanguage,
  payload,
}: {
  sourceLanguage: Locale;
  targetLanguage: Locale;
  payload: Record<string, string>;
}): Promise<T | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const model = getTranslationModel();
  const cacheKey = buildTranslationCacheKey(model, sourceLanguage, targetLanguage, payload);
  const cachedRaw = await readTranslationCache(cacheKey);
  if (cachedRaw) {
    try {
      return JSON.parse(cachedRaw) as T;
    } catch {
      /* stale or corrupt — fall through */
    }
  }

  const sourceLabel = sourceLanguage === "zh" ? "Chinese" : "English";
  const targetLabel = targetLanguage === "zh" ? "Chinese" : "English";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a software localization engine. Translate the JSON string values only. Preserve keys exactly. Keep empty strings empty. Keep product models, firmware versions, error codes, file names, IDs, URLs, and person names unchanged unless they are ordinary prose that clearly needs translation. Return valid JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: `Translate all values from ${sourceLabel} to ${targetLabel}.`,
            payload,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Translation request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  const parsed = JSON.parse(content) as T;
  await writeTranslationCache(cacheKey, JSON.stringify(parsed));
  return parsed;
}

function toNullableText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback.trim() ? fallback : null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function translateIssueContent(
  input: IssueTranslationInput,
): Promise<IssueTranslationResult> {
  const contentLanguage = detectIssueContentLanguage([
    input.title,
    input.symptom,
    input.cause,
    input.solution,
  ]);

  if (!contentLanguage || !isTranslationConfigured()) {
    return {
      contentLanguage,
      titleTranslated: null,
      symptomTranslated: null,
      causeTranslated: null,
      solutionTranslated: null,
    };
  }

  const targetLanguage = getOppositeLocale(contentLanguage);

  try {
    const translated = await translateJson<Record<string, string>>({
      sourceLanguage: contentLanguage,
      targetLanguage,
      payload: {
        title: input.title,
        symptom: input.symptom,
        cause: input.cause,
        solution: input.solution,
      },
    });

    return {
      contentLanguage,
      titleTranslated: toNullableText(translated?.title, input.title),
      symptomTranslated: toNullableText(translated?.symptom, input.symptom),
      causeTranslated: toNullableText(translated?.cause, input.cause),
      solutionTranslated: toNullableText(translated?.solution, input.solution),
    };
  } catch (error) {
    console.error("Issue translation failed:", error);
    return {
      contentLanguage,
      titleTranslated: null,
      symptomTranslated: null,
      causeTranslated: null,
      solutionTranslated: null,
    };
  }
}

export async function translateThreadContent(content: string): Promise<ThreadTranslationResult> {
  const contentLanguage = detectIssueContentLanguage([content]);
  if (!contentLanguage || !content.trim() || !isTranslationConfigured()) {
    return { contentLanguage, contentTranslated: null };
  }

  try {
    const translated = await translateJson<{ content?: string }>({
      sourceLanguage: contentLanguage,
      targetLanguage: getOppositeLocale(contentLanguage),
      payload: { content },
    });

    return {
      contentLanguage,
      contentTranslated: toNullableText(translated?.content, content),
    };
  } catch (error) {
    console.error("Thread translation failed:", error);
    return { contentLanguage, contentTranslated: null };
  }
}
