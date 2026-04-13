import { IssueKanban } from "@/components/issue-kanban";
import { getServerTranslator } from "@/i18n/server";

export default async function KanbanPage() {
  const t = await getServerTranslator();
  return (
    <div className="space-y-4">
      <header className="surface-elevated-dark rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("kanban.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("kanban.subtitle")}</p>
      </header>
      <IssueKanban />
    </div>
  );
}
