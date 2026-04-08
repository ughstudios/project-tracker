/** Result shape compatible with checking `ok` / `status` / `json()` like `fetch`. */
export type FormDataUploadResult = {
  ok: boolean;
  status: number;
  json: <T = unknown>() => Promise<T>;
};

function parseJsonBody<T>(bodyText: string): T {
  if (!bodyText.trim()) return {} as T;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return {} as T;
  }
}

/**
 * POST multipart `FormData` with upload progress (via `XMLHttpRequest`).
 * Use this instead of `fetch` when the UI should show a progress bar.
 */
export function postFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number | null) => void,
): Promise<FormDataUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.responseType = "text";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((100 * e.loaded) / e.total)));
      } else {
        onProgress(null);
      }
    };

    xhr.onload = () => {
      const status = xhr.status;
      const bodyText = xhr.responseText ?? "";
      resolve({
        ok: status >= 200 && status < 300,
        status,
        json: <T = unknown>() => Promise.resolve(parseJsonBody<T>(bodyText)),
      });
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new Error("Aborted"));

    xhr.send(formData);
  });
}
