/** Safe stored filename (browser + Node); matches legacy `issue-files` behavior without `node:path`. */

function extname(originalName: string): string {
  const i = originalName.lastIndexOf(".");
  if (i <= 0 || i === originalName.length - 1) return "";
  return originalName.slice(i).toLowerCase();
}

function basenameStem(originalName: string, ext: string): string {
  if (ext && originalName.toLowerCase().endsWith(ext.toLowerCase())) {
    return originalName.slice(0, originalName.length - ext.length);
  }
  const i = originalName.lastIndexOf(".");
  return i > 0 ? originalName.slice(0, i) : originalName;
}

export function storedFileName(originalName: string): string {
  const ext = extname(originalName);
  const base = basenameStem(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${stamp}-${base || "file"}${ext}`;
}
