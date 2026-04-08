import {
  ISSUE_UPLOAD_MAX_FILES_PER_POST,
  maxClientBlobUploadBytes,
  maxIssueUploadBytesForRuntime,
} from "@/lib/issue-files";

function browserContentTypeForFile(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".cbp": "application/octet-stream",
    ".rcvbp": "application/octet-stream",
  };
  return map[ext] ?? "application/octet-stream";
}

export type BlobTokenExtras =
  | { scope: "project"; projectId: string }
  | { scope: "customer"; customerId: string }
  | { scope: "issue"; issueId: string }
  | { scope: "thread"; issueId: string; threadEntryId: string };

export function validateFilesBeforeUpload(files: File[]): string | null {
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per upload.`;
  }
  const cap = maxClientBlobUploadBytes();
  for (const f of files) {
    if (f.size > cap) return "One or more files are too large.";
  }
  return null;
}

/** Multipart form uploads on Vercel are capped smaller than direct Blob; use this when not using Blob. */
export function validateFilesBeforeMultipartUpload(files: File[]): string | null {
  if (files.length > ISSUE_UPLOAD_MAX_FILES_PER_POST) {
    return `At most ${ISSUE_UPLOAD_MAX_FILES_PER_POST} files per upload.`;
  }
  const cap = maxIssueUploadBytesForRuntime();
  for (const f of files) {
    if (f.size > cap) return "One or more files are too large.";
  }
  return null;
}

type TokenResponse = { clientToken: string; pathname: string };

async function fetchBlobToken(
  extras: BlobTokenExtras,
  file: File,
): Promise<{ ok: true; data: TokenResponse } | { ok: false; error: string }> {
  const res = await fetch("/api/blob/client-token", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...extras,
      fileName: file.name,
      fileSize: file.size,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as { error?: string } & Partial<TokenResponse>;
  if (!res.ok) {
    return { ok: false, error: raw.error ?? "Could not start upload." };
  }
  if (!raw.clientToken || !raw.pathname) {
    return { ok: false, error: "Invalid token response." };
  }
  return { ok: true, data: { clientToken: raw.clientToken, pathname: raw.pathname } };
}

async function completeRegistration(
  completeUrl: string,
  body: { fileName: string; pathname: string; fileUrl: string; fileSize: number },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(completeUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: raw.error ?? "Could not save attachment." };
  }
  return { ok: true };
}

/**
 * Upload files via Vercel Blob from the browser, then register each with `completeUrl`.
 * `onProgress` receives approximate overall percent (0–100) or `null` if indeterminate.
 */
export async function uploadFilesViaBlobClient(options: {
  files: File[];
  tokenExtras: BlobTokenExtras;
  completeUrl: string;
  onProgress: (percent: number | null) => void;
}): Promise<{ ok: boolean; error?: string }> {
  const { files, tokenExtras, completeUrl } = options;
  const pre = validateFilesBeforeUpload(files);
  if (pre) return { ok: false, error: pre };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  let doneBytes = 0;
  const { put } = await import("@vercel/blob/client");

  for (const file of files) {
    const tok = await fetchBlobToken(tokenExtras, file);
    if (!tok.ok) return { ok: false, error: tok.error };

    let blobUrl: string;
    try {
      const uploaded = await put(tok.data.pathname, file, {
        access: "public",
        token: tok.data.clientToken,
        contentType: browserContentTypeForFile(file),
        onUploadProgress: ({ loaded, total, percentage }) => {
          if (totalBytes <= 0) {
            options.onProgress(null);
            return;
          }
          const slice = total > 0 ? (file.size * loaded) / total : (file.size * percentage) / 100;
          const pct = Math.min(100, Math.round(((doneBytes + slice) / totalBytes) * 100));
          options.onProgress(pct);
        },
      });
      blobUrl = uploaded.url;
    } catch {
      return { ok: false, error: "Upload failed." };
    }

    const reg = await completeRegistration(completeUrl, {
      fileName: file.name,
      pathname: tok.data.pathname,
      fileUrl: blobUrl,
      fileSize: file.size,
    });
    if (!reg.ok) return { ok: false, error: reg.error };

    doneBytes += file.size;
    options.onProgress(Math.min(100, Math.round((doneBytes / totalBytes) * 100)));
  }

  options.onProgress(100);
  return { ok: true };
}
