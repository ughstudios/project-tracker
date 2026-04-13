"use client";

import { useI18n } from "@/i18n/context";
import { useEffect, useState } from "react";

type Props = {
  uploadNote: string;
  onSave: (note: string) => Promise<boolean>;
  /** e.g. border-zinc-200 dark:border-zinc-700 vs border-zinc-100 dark:border-zinc-800 for nested cards */
  borderClassName?: string;
  /** When true, show note text only (no edit/save). */
  readOnly?: boolean;
};

export function AttachmentNoteInlineEditor({
  uploadNote,
  onSave,
  borderClassName = "border-zinc-200 dark:border-zinc-700",
  readOnly = false,
}: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(uploadNote);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(uploadNote);
  }, [uploadNote, editing]);

  const startEdit = () => {
    setDraft(uploadNote);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(uploadNote);
  };

  const save = async () => {
    const note = draft.trim();
    if (!note) {
      alert(t("common.attachmentUploadNoteRequiredAlert"));
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave(note);
      if (ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`mt-2 border-t pt-2 ${borderClassName}`}>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t("common.attachmentNoteHeading")}</p>
        <textarea
          className="input mt-1 min-h-[72px] w-full text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-800"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-2 border-t pt-2 ${borderClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("common.attachmentNoteHeading")}: </span>
          {uploadNote.trim() || t("common.attachmentNoteEmpty")}
        </p>
        {readOnly ? null : (
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 text-xs font-medium text-blue-700 underline"
          >
            {uploadNote.trim() ? t("common.editNote") : t("common.addNote")}
          </button>
        )}
      </div>
    </div>
  );
}
