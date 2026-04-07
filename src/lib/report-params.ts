import {
  ISSUE_COLUMN_KEYS,
  USER_COLUMN_KEYS,
  WORK_COLUMN_KEYS,
  type IssueColumnKey,
  type UserColumnKey,
  type WorkColumnKey,
} from "@/lib/report-column-defs";

/** CSV presentation: friendly headers & dates vs. technical names & ISO-8601. */
export type ReportFormat = "human" | "technical";

export function parseReportQuery(searchParams: URLSearchParams): { format: ReportFormat } {
  const f = searchParams.get("format");
  const format: ReportFormat = f === "technical" ? "technical" : "human";
  return { format };
}

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
  return parseColsList(raw, ISSUE_SET, ISSUE_COLUMN_KEYS) as IssueColumnKey[];
}

export function parseWorkCols(searchParams: URLSearchParams): WorkColumnKey[] {
  const raw = searchParams.get("workCols");
  return parseColsList(raw, WORK_SET, WORK_COLUMN_KEYS) as WorkColumnKey[];
}

export function parseUserCols(searchParams: URLSearchParams): UserColumnKey[] {
  const raw = searchParams.get("userCols");
  return parseColsList(raw, USER_SET, USER_COLUMN_KEYS) as UserColumnKey[];
}
