import type { Customer, Issue, Project, User, WorkRecord } from "@/generated/prisma";
import { csvRow } from "@/lib/csv";

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

export function issuesToCsv(issues: IssueWithRelations[]): string {
  const lines: string[] = [
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
  ];
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

export function workRecordsToCsv(records: WorkRecordWithUser[]): string {
  const lines: string[] = [
    csvRow(["id", "userId", "userName", "userEmail", "workDate", "title", "content", "createdAt", "updatedAt"]),
  ];
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

export function usersToCsv(users: UserExport[]): string {
  const lines = [
    csvRow(["id", "name", "email", "role", "approvalStatus", "createdAt"]),
  ];
  for (const u of users) {
    lines.push(
      csvRow([u.id, u.name, u.email, u.role, u.approvalStatus, u.createdAt.toISOString()]),
    );
  }
  return lines.join("");
}
