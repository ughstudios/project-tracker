import type { Locale } from "@/i18n/types";

export type ContentLanguage = Locale;

export function normalizeContentLanguage(value: unknown): ContentLanguage | null {
  return value === "en" || value === "zh" ? value : null;
}

export function getOppositeLocale(locale: Locale): Locale {
  return locale === "en" ? "zh" : "en";
}

export function getLocalizedText({
  original,
  translated,
  sourceLanguage,
  locale,
}: {
  original: string;
  translated?: string | null;
  sourceLanguage?: unknown;
  locale: Locale;
}) {
  const normalizedSource = normalizeContentLanguage(sourceLanguage);
  const cleanTranslated = translated?.trim() ?? "";
  const cleanOriginal = original.trim();
  const differsFromOriginal = cleanTranslated !== cleanOriginal;
  const shouldUseTranslation =
    Boolean(cleanTranslated) &&
    differsFromOriginal &&
    normalizedSource !== null &&
    normalizedSource !== locale;

  return {
    sourceLanguage: normalizedSource,
    text: shouldUseTranslation ? cleanTranslated : original,
    usedTranslation: shouldUseTranslation,
  };
}
