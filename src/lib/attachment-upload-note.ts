const MAX_UPLOAD_NOTE_LEN = 8000;

export function parseRequiredUploadNote(
  uploadNote: unknown,
): { ok: true; uploadNote: string } | { error: string } {
  if (typeof uploadNote !== "string") {
    return { error: "Upload note is required." };
  }
  const trimmed = uploadNote.trim();
  if (!trimmed) {
    return { error: "Upload note is required." };
  }
  if (trimmed.length > MAX_UPLOAD_NOTE_LEN) {
    return { error: `Upload note must be at most ${MAX_UPLOAD_NOTE_LEN} characters.` };
  }
  return { ok: true, uploadNote: trimmed };
}
