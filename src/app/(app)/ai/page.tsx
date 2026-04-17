import { AiAssistantClient } from "@/components/ai-assistant-client";
import { getServerTranslator } from "@/i18n/server";

export default async function AiPage() {
  const t = await getServerTranslator();

  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("aiAssistant.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("aiAssistant.subtitle")}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">{t("aiAssistant.disclaimer")}</p>
      </header>
      <AiAssistantClient />
    </div>
  );
}
