/** Parse YYYY-MM; return UTC start (inclusive) and end (inclusive) of that calendar month. */
export function parseYearMonth(value: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12 || !Number.isFinite(y)) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return { start, end };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Calendar date in UTC, e.g. 2026-04-06 (readable in spreadsheets). */
export function formatDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Date and time in UTC, e.g. 2026-04-06 14:30 UTC (no ambiguous Z suffix in cells).
 */
export function formatDateTimeUtc(d: Date): string {
  return `${formatDateUtc(d)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/** Parse YYYY-MM-DD as UTC date; returns UTC start of that day or null. */
export function parseDateUtcDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}
