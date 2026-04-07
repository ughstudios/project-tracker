/** RFC 4180-style CSV cell escaping for exports. */
export function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(",") + "\r\n";
}

export function withBomUtf8(csv: string): string {
  return `\uFEFF${csv}`;
}
