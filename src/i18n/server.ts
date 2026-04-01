import { cookies } from "next/headers";
import { createTranslator } from "./create-translator";
import { getDictionary, isLocale } from "./dictionaries";
import type { Locale } from "./types";
import { LOCALE_COOKIE } from "./types";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : "en";
}

export async function getServerTranslator() {
  const locale = await getLocale();
  return createTranslator(getDictionary(locale));
}
