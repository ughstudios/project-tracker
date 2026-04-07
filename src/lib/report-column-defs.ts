import type { Customer, Issue, Project, User, WorkRecord } from "@/generated/prisma";
import { csvRow } from "@/lib/csv";
import { formatDateTimeUtc, formatDateUtc } from "@/lib/report-dates";
import type { ReportFormat } from "@/lib/report-params";

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

function fmtDate(d: Date | null | undefined, format: ReportFormat): string {
  if (d == null) return "";
  return format === "technical" ? d.toISOString() : formatDateUtc(d);
}

function fmtDateTime(d: Date | null | undefined, format: ReportFormat): string {
  if (d == null) return "";
  return format === "technical" ? d.toISOString() : formatDateTimeUtc(d);
}

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

const ISSUE_COLS: Record<
  IssueColumnKey,
  { humanHeader: string; technicalHeader: string; cell: (i: IssueWithRelations, f: ReportFormat) => string }
> = {
  id: { humanHeader: "ID", technicalHeader: "id", cell: (i) => i.id },
  title: { humanHeader: "Title", technicalHeader: "title", cell: (i) => i.title },
  status: { humanHeader: "Status", technicalHeader: "status", cell: (i) => i.status },
  symptom: { humanHeader: "Symptom", technicalHeader: "symptom", cell: (i) => i.symptom },
  cause: { humanHeader: "Cause", technicalHeader: "cause", cell: (i) => i.cause },
  solution: { humanHeader: "Solution", technicalHeader: "solution", cell: (i) => i.solution },
  rndContact: { humanHeader: "R&D contact", technicalHeader: "rndContact", cell: (i) => i.rndContact },
  projectName: {
    humanHeader: "Project",
    technicalHeader: "projectName",
    cell: (i) => i.project?.name ?? "",
  },
  customerName: {
    humanHeader: "Customer",
    technicalHeader: "customerName",
    cell: (i) => i.customer?.name ?? "",
  },
  assigneeName: {
    humanHeader: "Assignee",
    technicalHeader: "assigneeName",
    cell: (i) => i.assignee?.name ?? "",
  },
  assigneeEmail: {
    humanHeader: "Assignee email",
    technicalHeader: "assigneeEmail",
    cell: (i) => i.assignee?.email ?? "",
  },
  reporterName: {
    humanHeader: "Reporter",
    technicalHeader: "reporterName",
    cell: (i) => i.reporter.name,
  },
  reporterEmail: {
    humanHeader: "Reporter email",
    technicalHeader: "reporterEmail",
    cell: (i) => i.reporter.email,
  },
  createdAt: {
    humanHeader: "Opened",
    technicalHeader: "createdAt",
    cell: (i, f) => fmtDate(i.createdAt, f),
  },
  updatedAt: {
    humanHeader: "Last updated",
    technicalHeader: "updatedAt",
    cell: (i, f) => fmtDateTime(i.updatedAt, f),
  },
  doneAt: {
    humanHeader: "Completed",
    technicalHeader: "doneAt",
    cell: (i, f) => fmtDate(i.doneAt, f),
  },
  archivedAt: {
    humanHeader: "Archived",
    technicalHeader: "archivedAt",
    cell: (i, f) => fmtDate(i.archivedAt, f),
  },
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

const WORK_COLS: Record<
  WorkColumnKey,
  { humanHeader: string; technicalHeader: string; cell: (r: WorkRecordWithUser, f: ReportFormat) => string }
> = {
  id: { humanHeader: "Record ID", technicalHeader: "id", cell: (r) => r.id },
  userId: { humanHeader: "User ID", technicalHeader: "userId", cell: (r) => r.userId },
  userName: { humanHeader: "Person", technicalHeader: "userName", cell: (r) => r.user.name },
  userEmail: { humanHeader: "Email", technicalHeader: "userEmail", cell: (r) => r.user.email },
  workDate: {
    humanHeader: "Work date",
    technicalHeader: "workDate",
    cell: (r, f) => (f === "technical" ? r.workDate.toISOString() : formatDateUtc(r.workDate)),
  },
  title: { humanHeader: "Title", technicalHeader: "title", cell: (r) => r.title },
  content: { humanHeader: "What you did", technicalHeader: "content", cell: (r) => r.content },
  createdAt: {
    humanHeader: "First saved",
    technicalHeader: "createdAt",
    cell: (r, f) => fmtDateTime(r.createdAt, f),
  },
  updatedAt: {
    humanHeader: "Last updated",
    technicalHeader: "updatedAt",
    cell: (r, f) => fmtDateTime(r.updatedAt, f),
  },
};

export const USER_COLUMN_KEYS = ["id", "name", "email", "role", "approvalStatus", "createdAt"] as const;

export type UserColumnKey = (typeof USER_COLUMN_KEYS)[number];

const USER_COLS: Record<
  UserColumnKey,
  { humanHeader: string; technicalHeader: string; cell: (u: UserExport, f: ReportFormat) => string }
> = {
  id: { humanHeader: "ID", technicalHeader: "id", cell: (u) => u.id },
  name: { humanHeader: "Name", technicalHeader: "name", cell: (u) => u.name },
  email: { humanHeader: "Email", technicalHeader: "email", cell: (u) => u.email },
  role: { humanHeader: "Role", technicalHeader: "role", cell: (u) => u.role },
  approvalStatus: {
    humanHeader: "Status",
    technicalHeader: "approvalStatus",
    cell: (u) => u.approvalStatus,
  },
  createdAt: {
    humanHeader: "Joined",
    technicalHeader: "createdAt",
    cell: (u, f) => (f === "technical" ? u.createdAt.toISOString() : formatDateUtc(u.createdAt)),
  },
};

export function issuesToCsv(
  issues: IssueWithRelations[],
  format: ReportFormat,
  columns: IssueColumnKey[],
): string {
  if (columns.length === 0) return "";
  const header = columns.map((k) =>
    format === "technical" ? ISSUE_COLS[k].technicalHeader : ISSUE_COLS[k].humanHeader,
  );
  const lines = [csvRow(header)];
  for (const row of issues) {
    lines.push(csvRow(columns.map((k) => ISSUE_COLS[k].cell(row, format))));
  }
  return lines.join("");
}

export function workRecordsToCsv(
  records: WorkRecordWithUser[],
  format: ReportFormat,
  columns: WorkColumnKey[],
): string {
  if (columns.length === 0) return "";
  const header = columns.map((k) =>
    format === "technical" ? WORK_COLS[k].technicalHeader : WORK_COLS[k].humanHeader,
  );
  const lines = [csvRow(header)];
  for (const row of records) {
    lines.push(csvRow(columns.map((k) => WORK_COLS[k].cell(row, format))));
  }
  return lines.join("");
}

export function usersToCsv(users: UserExport[], format: ReportFormat, columns: UserColumnKey[]): string {
  if (columns.length === 0) return "";
  const header = columns.map((k) =>
    format === "technical" ? USER_COLS[k].technicalHeader : USER_COLS[k].humanHeader,
  );
  const lines = [csvRow(header)];
  for (const row of users) {
    lines.push(csvRow(columns.map((k) => USER_COLS[k].cell(row, format))));
  }
  return lines.join("");
}
