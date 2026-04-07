/** CSV export presentation: readable dates & columns vs. internal IDs and ISO-8601. */
export type ReportFormat = "human" | "technical";

/** Standard = main fields; extended = long text / audit timestamps where applicable. */
export type ReportDetail = "standard" | "extended";

export function parseReportQuery(searchParams: URLSearchParams): {
  format: ReportFormat;
} {
  const f = searchParams.get("format");
  const format: ReportFormat = f === "technical" ? "technical" : "human";
  return { format };
}

export function parseDetail(searchParams: URLSearchParams, key: string, defaultDetail: ReportDetail): ReportDetail {
  const d = searchParams.get(key) ?? searchParams.get("detail");
  if (d === "extended" || d === "standard") return d;
  return defaultDetail;
}
