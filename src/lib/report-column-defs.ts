import type { Customer, Issue, Project, User, WorkRecord } from "@/generated/prisma";
import { csvRow } from "@/lib/csv";
import { formatDateTimeUtc, formatDateUtc } from "@/lib/report-dates";

export type IssueWithRelations = Issue & {
  project: Pick<Project, "name"> | null;
  customer: Pick<Customer, "name"> | null;
  assignee: Pick<User, "name" | "email"> | null;
  reporter: Pick<User, "name" | "email">;
};

export type WorkRecordWithUser = WorkRecord & {
  user: Pick<User, "name" | "email">;
};

export type UserExport = Pick<User, "id" | "name" | "email" | "role" | "createdAt" | "approvalStatus">;

/** Keys treated as internal IDs: off by default; not selected by “select all (recommended)”. */
export const ISSUE_ID_KEYS = new Set<string>(["id"]);
export const WORK_ID_KEYS = new Set<string>(["id", "userId"]);
export const USER_ID_KEYS = new Set<string>(["id"]);

export const ISSUE_COLUMN_KEYS = [
  "id",
  "title",
  "status",
  "symptom",
  "cause",
  "solution",
  "rndContact",
  "projectName",
  "customerName",
  "assigneeName",
  "assigneeEmail",
  "reporterName",
  "reporterEmail",
  "createdAt",
  "updatedAt",
  "doneAt",
  "archivedAt",
] as const;

export type IssueColumnKey = (typeof ISSUE_COLUMN_KEYS)[number];

export const DEFAULT_ISSUE_COLUMNS: IssueColumnKey[] = ISSUE_COLUMN_KEYS.filter(
  (k) => !ISSUE_ID_KEYS.has(k),
) as IssueColumnKey[];

const ISSUE_COLS: Record<
  IssueColumnKey,
  { header: string; cell: (i: IssueWithRelations) => string }
> = {
  id: { header: "ID", cell: (i) => i.id },
  title: { header: "Title", cell: (i) => i.title },
  status: { header: "Status", cell: (i) => i.status },
  symptom: { header: "Symptom", cell: (i) => i.symptom },
  cause: { header: "Cause", cell: (i) => i.cause },
  solution: { header: "Solution", cell: (i) => i.solution },
  rndContact: { header: "R&D contact", cell: (i) => i.rndContact },
  projectName: { header: "Project", cell: (i) => i.project?.name ?? "" },
  customerName: { header: "Customer", cell: (i) => i.customer?.name ?? "" },
  assigneeName: { header: "Assignee", cell: (i) => i.assignee?.name ?? "" },
  assigneeEmail: { header: "Assignee email", cell: (i) => i.assignee?.email ?? "" },
  reporterName: { header: "Reporter", cell: (i) => i.reporter.name },
  reporterEmail: { header: "Reporter email", cell: (i) => i.reporter.email },
  createdAt: { header: "Opened", cell: (i) => formatDateUtc(i.createdAt) },
  updatedAt: { header: "Last updated", cell: (i) => formatDateTimeUtc(i.updatedAt) },
  doneAt: { header: "Completed", cell: (i) => (i.doneAt ? formatDateUtc(i.doneAt) : "") },
  archivedAt: { header: "Archived", cell: (i) => (i.archivedAt ? formatDateUtc(i.archivedAt) : "") },
};

export const WORK_COLUMN_KEYS = [
  "id",
  "userId",
  "userName",
  "userEmail",
  "workDate",
  "title",
  "content",
  "createdAt",
  "updatedAt",
] as const;

export type WorkColumnKey = (typeof WORK_COLUMN_KEYS)[number];

export const DEFAULT_WORK_COLUMNS: WorkColumnKey[] = WORK_COLUMN_KEYS.filter(
  (k) => !WORK_ID_KEYS.has(k),
) as WorkColumnKey[];

const WORK_COLS: Record<WorkColumnKey, { header: string; cell: (r: WorkRecordWithUser) => string }> =
  {
    id: { header: "Record ID", cell: (r) => r.id },
    userId: { header: "User ID", cell: (r) => r.userId },
    userName: { header: "Person", cell: (r) => r.user.name },
    userEmail: { header: "Email", cell: (r) => r.user.email },
    workDate: { header: "Work date", cell: (r) => formatDateUtc(r.workDate) },
    title: { header: "Title", cell: (r) => r.title },
    content: { header: "What you did", cell: (r) => r.content },
    createdAt: { header: "First saved", cell: (r) => formatDateTimeUtc(r.createdAt) },
    updatedAt: { header: "Last updated", cell: (r) => formatDateTimeUtc(r.updatedAt) },
  };

export const USER_COLUMN_KEYS = ["id", "name", "email", "role", "approvalStatus", "createdAt"] as const;

export type UserColumnKey = (typeof USER_COLUMN_KEYS)[number];

export const DEFAULT_USER_COLUMNS: UserColumnKey[] = USER_COLUMN_KEYS.filter(
  (k) => !USER_ID_KEYS.has(k),
) as UserColumnKey[];

const USER_COLS: Record<UserColumnKey, { header: string; cell: (u: UserExport) => string }> = {
  id: { header: "ID", cell: (u) => u.id },
  name: { header: "Name", cell: (u) => u.name },
  email: { header: "Email", cell: (u) => u.email },
  role: { header: "Role", cell: (u) => u.role },
  approvalStatus: { header: "Status", cell: (u) => u.approvalStatus },
  createdAt: { header: "Joined", cell: (u) => formatDateUtc(u.createdAt) },
};

export function issuesToCsv(issues: IssueWithRelations[], columns: IssueColumnKey[]): string {
  if (columns.length === 0) return "";
  const lines = [csvRow(columns.map((k) => ISSUE_COLS[k].header))];
  for (const row of issues) {
    lines.push(csvRow(columns.map((k) => ISSUE_COLS[k].cell(row))));
  }
  return lines.join("");
}

export function workRecordsToCsv(records: WorkRecordWithUser[], columns: WorkColumnKey[]): string {
  if (columns.length === 0) return "";
  const lines = [csvRow(columns.map((k) => WORK_COLS[k].header))];
  for (const row of records) {
    lines.push(csvRow(columns.map((k) => WORK_COLS[k].cell(row))));
  }
  return lines.join("");
}

export function usersToCsv(users: UserExport[], columns: UserColumnKey[]): string {
  if (columns.length === 0) return "";
  const lines = [csvRow(columns.map((k) => USER_COLS[k].header))];
  for (const row of users) {
    lines.push(csvRow(columns.map((k) => USER_COLS[k].cell(row))));
  }
  return lines.join("");
}
