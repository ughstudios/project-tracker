"use client";

import { useI18n } from "@/i18n/context";
import type { Locale } from "@/i18n/types";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  const btn = (code: Locale, label: string) => (
    <button
      key={code}
      type="button"
      onClick={() => void setLocale(code)}
      className={[
        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
        locale === code
          ? "bg-zinc-900 text-white"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
      ].join(" ")}
      aria-pressed={locale === code}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs text-zinc-500">{t("language.label")}</span>
      <div className="flex gap-1">
        {btn("en", t("language.en"))}
        {btn("zh", t("language.zh"))}
      </div>
    </div>
  );
}
