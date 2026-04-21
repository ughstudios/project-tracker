import { createTranslator } from "@/i18n/create-translator";
import { getDictionary, isLocale } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/types";

export function localeFromFormData(formData: FormData): Locale {
  const raw = formData.get("locale");
  if (typeof raw === "string") {
    const v = raw.trim();
    if (isLocale(v)) return v;
  }
  return "en";
}

export function publicFormTranslator(locale: Locale) {
  return createTranslator(getDictionary(locale));
}
