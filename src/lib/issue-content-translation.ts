import type { Locale } from "@/i18n/types";
import {
  detectIssueContentLanguage,
  detectIssueContentLanguageForBackfill,
} from "@/lib/issue-content-language";
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

function getTranslationModelBase() {
  return process.env.OPENAI_TRANSLATION_MODEL?.trim() || "gpt-4o-mini";
}

/** OpenAI Chat Completions `model` field: short id for api.openai.com, `provider/model` for Vercel AI Gateway. */
function getTranslationModelForEndpoint(useGateway: boolean) {
  const m = getTranslationModelBase();
  if (!useGateway) return m;
  if (m.includes("/")) return m;
  return `openai/${m}`;
}

function getTranslationApiKeyAndUrl():
  | { apiKey: string; url: string; useGateway: boolean }
  | null {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey) {
    return {
      apiKey: gatewayKey,
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      useGateway: true,
    };
  }
  const openaiKey = process.env.AI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) return null;
  return {
    apiKey: openaiKey,
    url: "https://api.openai.com/v1/chat/completions",
    useGateway: false,
  };
}

export function isTranslationConfigured() {
  return getTranslationApiKeyAndUrl() != null;
}

/** Chat message content → parsed JSON (handles optional ```json fences). */
function parseTranslationJsonContent(raw: string): unknown | null {
  const s = raw.trim();
  const tryParse = (text: string) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  };
  let v = tryParse(s);
  if (v !== null) return v;
  const fence = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) {
    v = tryParse(fence[1].trim());
    if (v !== null) return v;
  }
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i >= 0 && j > i) {
    v = tryParse(s.slice(i, j + 1));
    if (v !== null) return v;
  }
  return null;
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
  const endpoint = getTranslationApiKeyAndUrl();
  if (!endpoint) return null;

  const model = getTranslationModelForEndpoint(endpoint.useGateway);
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

  const systemBase =
    "You are a software localization engine. Translate the JSON string values only. Preserve keys exactly. Keep empty strings empty. Keep product models, firmware versions, error codes, file names, IDs, URLs, and person names unchanged unless they are ordinary prose that clearly needs translation.";
  const systemSuffix = endpoint.useGateway
    ? " Reply with a single raw JSON object only (no markdown, no code fences)."
    : " Return valid JSON only.";

  const requestBody: Record<string, unknown> = {
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: systemBase + systemSuffix,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: `Translate all values from ${sourceLabel} to ${targetLabel}.`,
          payload,
        }),
      },
    ],
  };
  // Vercel AI Gateway rejects `response_format: json_object` for some models/routes (400 invalid_request_error).
  if (!endpoint.useGateway) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${endpoint.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
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

  const parsedUnknown = parseTranslationJsonContent(content);
  if (!parsedUnknown || typeof parsedUnknown !== "object") return null;
  const parsed = parsedUnknown as T;
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
  const contentLanguage = detectIssueContentLanguageForBackfill({
    title: input.title,
    symptom: input.symptom,
    cause: input.cause,
    solution: input.solution,
  });

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
