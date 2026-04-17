"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useI18n } from "@/i18n/context";
import { useMemo, useState, useCallback } from "react";
import type { UIMessage } from "ai";

function messageText(m: UIMessage) {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function AiAssistantClient() {
  const { locale, t } = useI18n();
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        credentials: "include",
        body: { locale },
      }),
    [locale],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || busy) return;
      setInput("");
      await sendMessage({ text });
    },
    [input, busy, sendMessage],
  );

  return (
    <div className="space-y-4">
      <div
        className="panel-surface max-h-[min(520px,70vh)] overflow-y-auto rounded-xl p-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("aiAssistant.emptyHint")}</p>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {m.role === "user" ? t("aiAssistant.roleUser") : t("aiAssistant.roleAssistant")}
                </span>
                <div className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {messageText(m)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <span>{error.message || t("aiAssistant.genericError")}</span>
          <button
            type="button"
            className="rounded-md border border-amber-400 px-2 py-1 text-xs font-medium dark:border-amber-600"
            onClick={() => clearError()}
          >
            {t("aiAssistant.dismissError")}
          </button>
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="mb-1 block">{t("aiAssistant.inputLabel")}</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            disabled={busy}
            className="field-input w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder={t("aiAssistant.inputPlaceholder")}
          />
        </label>
        <div className="flex shrink-0 gap-2">
          {busy ? (
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
              onClick={() => void stop()}
            >
              {t("aiAssistant.stop")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? t("aiAssistant.sending") : t("aiAssistant.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
