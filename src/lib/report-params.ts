import {
  DEFAULT_ISSUE_COLUMNS,
  DEFAULT_USER_COLUMNS,
  DEFAULT_WORK_COLUMNS,
  ISSUE_COLUMN_KEYS,
  USER_COLUMN_KEYS,
  WORK_COLUMN_KEYS,
  type IssueColumnKey,
  type UserColumnKey,
  type WorkColumnKey,
} from "@/lib/report-column-defs";

const ISSUE_SET = new Set<string>(ISSUE_COLUMN_KEYS);
const WORK_SET = new Set<string>(WORK_COLUMN_KEYS);
const USER_SET = new Set<string>(USER_COLUMN_KEYS);

function parseColsList(
  raw: string | null,
  allowed: ReadonlySet<string>,
  fallbackOrdered: readonly string[],
): string[] {
  if (!raw?.trim()) return [...fallbackOrdered];
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (!allowed.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.length ? out : [...fallbackOrdered];
}

export function parseIssueCols(searchParams: URLSearchParams): IssueColumnKey[] {
  const raw = searchParams.get("issueCols");
  return parseColsList(raw, ISSUE_SET, DEFAULT_ISSUE_COLUMNS) as IssueColumnKey[];
}

export function parseWorkCols(searchParams: URLSearchParams): WorkColumnKey[] {
  const raw = searchParams.get("workCols");
  return parseColsList(raw, WORK_SET, DEFAULT_WORK_COLUMNS) as WorkColumnKey[];
}

export function parseUserCols(searchParams: URLSearchParams): UserColumnKey[] {
  const raw = searchParams.get("userCols");
  return parseColsList(raw, USER_SET, DEFAULT_USER_COLUMNS) as UserColumnKey[];
}
