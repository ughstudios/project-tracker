"use client";

import { useI18n } from "@/i18n/context";
import { useEffect, useState } from "react";

type Props = {
  uploadNote: string;
  onSave: (note: string) => Promise<boolean>;
  /** e.g. border-zinc-200 vs border-zinc-100 for nested cards */
  borderClassName?: string;
};

export function AttachmentNoteInlineEditor({
  uploadNote,
  onSave,
  borderClassName = "border-zinc-200",
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
        <p className="text-xs font-medium text-zinc-700">{t("common.attachmentNoteHeading")}</p>
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
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium hover:bg-zinc-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
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
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs text-zinc-600">
          <span className="font-medium text-zinc-700">{t("common.attachmentNoteHeading")}: </span>
          {uploadNote.trim() || t("common.attachmentNoteEmpty")}
        </p>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 text-xs font-medium text-blue-700 underline"
        >
          {uploadNote.trim() ? t("common.editNote") : t("common.addNote")}
        </button>
      </div>
    </div>
  );
}
