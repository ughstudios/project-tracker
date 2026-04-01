"use client";

import { LanguageToggle } from "@/components/language-toggle";

export function GuestLanguageBar() {
  return (
    <div className="mb-4 flex w-full justify-end">
      <LanguageToggle />
    </div>
  );
}
