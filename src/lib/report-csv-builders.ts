import type { Customer, Issue, Project, User, WorkRecord } from "@/generated/prisma";
import { csvRow } from "@/lib/csv";
import { formatDateTimeUtc, formatDateUtc } from "@/lib/report-dates";
import type { ReportDetail, ReportFormat } from "@/lib/report-params";

type IssueWithRelations = Issue & {
  project: Pick<Project, "name"> | null;
  customer: Pick<Customer, "name"> | null;
  assignee: Pick<User, "name" | "email"> | null;
  reporter: Pick<User, "name" | "email">;
};

type WorkRecordWithUser = WorkRecord & {
  user: Pick<User, "name" | "email">;
};

type UserExport = Pick<User, "id" | "name" | "email" | "role" | "createdAt" | "approvalStatus">;

export type CsvBuildOptions = {
  format: ReportFormat;
  detail: ReportDetail;
};

function fmtDate(d: Date | null | undefined, format: ReportFormat): string {
  if (d == null) return "";
  return format === "technical" ? d.toISOString() : formatDateUtc(d);
}

function fmtDateTime(d: Date | null | undefined, format: ReportFormat): string {
  if (d == null) return "";
  return format === "technical" ? d.toISOString() : formatDateTimeUtc(d);
}

export function issuesToCsv(issues: IssueWithRelations[], opts: CsvBuildOptions): string {
  const { format, detail } = opts;
  const extended = detail === "extended";
  const lines: string[] = [];

  if (format === "technical") {
    lines.push(
      csvRow([
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
      ]),
    );
    for (const i of issues) {
      lines.push(
        csvRow([
          i.id,
          i.title,
          i.status,
          i.symptom,
          i.cause,
          i.solution,
          i.rndContact,
          i.project?.name ?? "",
          i.customer?.name ?? "",
          i.assignee?.name ?? "",
          i.assignee?.email ?? "",
          i.reporter.name,
          i.reporter.email,
          i.createdAt.toISOString(),
          i.updatedAt.toISOString(),
          i.doneAt?.toISOString() ?? "",
          i.archivedAt?.toISOString() ?? "",
        ]),
      );
    }
    return lines.join("");
  }

  if (extended) {
    lines.push(
      csvRow([
        "Title",
        "Status",
        "Project",
        "Customer",
        "Assignee",
        "Assignee email",
        "Reporter",
        "Reporter email",
        "Opened",
        "Last updated",
        "Completed",
        "Archived",
        "Symptom",
        "Cause",
        "Solution",
        "R&D contact",
      ]),
    );
    for (const i of issues) {
      lines.push(
        csvRow([
          i.title,
          i.status,
          i.project?.name ?? "",
          i.customer?.name ?? "",
          i.assignee?.name ?? "",
          i.assignee?.email ?? "",
          i.reporter.name,
          i.reporter.email,
          fmtDate(i.createdAt, format),
          fmtDateTime(i.updatedAt, format),
          fmtDate(i.doneAt, format),
          fmtDate(i.archivedAt, format),
          i.symptom,
          i.cause,
          i.solution,
          i.rndContact,
        ]),
      );
    }
  } else {
    lines.push(
      csvRow([
        "Title",
        "Status",
        "Project",
        "Customer",
        "Assignee",
        "Assignee email",
        "Reporter",
        "Reporter email",
        "Opened",
        "Last updated",
        "Completed",
        "Archived",
      ]),
    );
    for (const i of issues) {
      lines.push(
        csvRow([
          i.title,
          i.status,
          i.project?.name ?? "",
          i.customer?.name ?? "",
          i.assignee?.name ?? "",
          i.assignee?.email ?? "",
          i.reporter.name,
          i.reporter.email,
          fmtDate(i.createdAt, format),
          fmtDateTime(i.updatedAt, format),
          fmtDate(i.doneAt, format),
          fmtDate(i.archivedAt, format),
        ]),
      );
    }
  }

  return lines.join("");
}

export function workRecordsToCsv(records: WorkRecordWithUser[], opts: CsvBuildOptions): string {
  const { format, detail } = opts;
  const lines: string[] = [];

  if (format === "technical") {
    lines.push(
      csvRow([
        "id",
        "userId",
        "userName",
        "userEmail",
        "workDate",
        "title",
        "content",
        "createdAt",
        "updatedAt",
      ]),
    );
    for (const r of records) {
      lines.push(
        csvRow([
          r.id,
          r.userId,
          r.user.name,
          r.user.email,
          r.workDate.toISOString(),
          r.title,
          r.content,
          r.createdAt.toISOString(),
          r.updatedAt.toISOString(),
        ]),
      );
    }
    return lines.join("");
  }

  const extended = detail === "extended";
  if (extended) {
    lines.push(
      csvRow([
        "Person",
        "Email",
        "Work date",
        "Title",
        "What you did",
        "First saved",
        "Last updated",
      ]),
    );
    for (const r of records) {
      lines.push(
        csvRow([
          r.user.name,
          r.user.email,
          fmtDate(r.workDate, format),
          r.title,
          r.content,
          fmtDateTime(r.createdAt, format),
          fmtDateTime(r.updatedAt, format),
        ]),
      );
    }
  } else {
    lines.push(csvRow(["Person", "Email", "Work date", "Title", "What you did"]));
    for (const r of records) {
      lines.push(
        csvRow([r.user.name, r.user.email, fmtDate(r.workDate, format), r.title, r.content]),
      );
    }
  }

  return lines.join("");
}

export function usersToCsv(users: UserExport[], opts: CsvBuildOptions): string {
  const { format } = opts;
  const lines: string[] = [];

  if (format === "technical") {
    lines.push(csvRow(["id", "name", "email", "role", "approvalStatus", "createdAt"]));
    for (const u of users) {
      lines.push(
        csvRow([u.id, u.name, u.email, u.role, u.approvalStatus, u.createdAt.toISOString()]),
      );
    }
  } else {
    lines.push(csvRow(["Name", "Email", "Role", "Status", "Joined"]));
    for (const u of users) {
      lines.push(csvRow([u.name, u.email, u.role, u.approvalStatus, formatDateUtc(u.createdAt)]));
    }
  }

  return lines.join("");
}
