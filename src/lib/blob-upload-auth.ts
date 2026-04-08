import { prisma } from "@/lib/prisma";

export type BlobClientUploadPayload = {
  scope: "project" | "customer" | "issue" | "thread" | "workRecord";
  projectId?: string;
  customerId?: string;
  issueId?: string;
  threadEntryId?: string;
  originalFileName: string;
};

export function expectedPathPrefix(
  payload: BlobClientUploadPayload,
  sessionUserId: string,
): string | null {
  switch (payload.scope) {
    case "workRecord":
      return sessionUserId ? `work-records/${sessionUserId}/` : null;
    case "project":
      return payload.projectId ? `projects/${payload.projectId}/` : null;
    case "customer":
      return payload.customerId ? `customers/${payload.customerId}/` : null;
    case "issue":
      return payload.issueId ? `issues/${payload.issueId}/` : null;
    case "thread":
      return payload.issueId && payload.threadEntryId
        ? `issues/${payload.issueId}/thread/${payload.threadEntryId}/`
        : null;
    default:
      return null;
  }
}

export function parseClientPayloadJsonString(raw: string | null): BlobClientUploadPayload | { error: string } {
  if (raw == null || raw === "") {
    return { error: "clientPayload is required." };
  }
  try {
    return parseBlobClientUploadPayloadFromUnknown(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return { error: "Invalid clientPayload." };
  }
}

export function parseBlobClientUploadPayloadFromUnknown(
  o: Record<string, unknown>,
): BlobClientUploadPayload | { error: string } {
  const scope = o.scope;
  if (
    scope !== "project" &&
    scope !== "customer" &&
    scope !== "issue" &&
    scope !== "thread" &&
    scope !== "workRecord"
  ) {
    return { error: "Invalid scope." };
  }
  const originalFileName =
    typeof o.originalFileName === "string" ? o.originalFileName.trim() : "";
  if (!originalFileName) {
    return { error: "originalFileName is required." };
  }
  return {
    scope,
    originalFileName,
    projectId: typeof o.projectId === "string" ? o.projectId : undefined,
    customerId: typeof o.customerId === "string" ? o.customerId : undefined,
    issueId: typeof o.issueId === "string" ? o.issueId : undefined,
    threadEntryId: typeof o.threadEntryId === "string" ? o.threadEntryId : undefined,
  };
}

export function isSafeStoredObjectKeyTail(tail: string): boolean {
  if (!tail || tail.length > 512) return false;
  if (tail.includes("/") || tail.includes("\\") || tail.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(tail);
}

export async function authorizeBlobClientPayload(
  payload: BlobClientUploadPayload,
  sessionUserId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  switch (payload.scope) {
    case "workRecord": {
      if (!sessionUserId) return { error: "Unauthorized.", status: 401 };
      break;
    }
    case "project": {
      const id = payload.projectId ?? "";
      if (!id) return { error: "projectId is required.", status: 400 };
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!project || project.archivedAt) {
        return { error: "Project not found.", status: 404 };
      }
      break;
    }
    case "customer": {
      const id = payload.customerId ?? "";
      if (!id) return { error: "customerId is required.", status: 400 };
      const customer = await prisma.customer.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!customer || customer.archivedAt) {
        return { error: "Customer not found.", status: 404 };
      }
      break;
    }
    case "issue": {
      const id = payload.issueId ?? "";
      if (!id) return { error: "issueId is required.", status: 400 };
      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { id: true, archivedAt: true },
      });
      if (!issue || issue.archivedAt) {
        return { error: "Issue not found.", status: 404 };
      }
      break;
    }
    case "thread": {
      const issueId = payload.issueId ?? "";
      const threadEntryId = payload.threadEntryId ?? "";
      if (!issueId || !threadEntryId) {
        return { error: "issueId and threadEntryId are required.", status: 400 };
      }
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { id: true, archivedAt: true },
      });
      if (!issue || issue.archivedAt) {
        return { error: "Issue not found.", status: 404 };
      }
      const entry = await prisma.issueThreadEntry.findFirst({
        where: { id: threadEntryId, issueId },
        select: { id: true },
      });
      if (!entry) {
        return { error: "Thread entry not found.", status: 404 };
      }
      break;
    }
    default:
      return { error: "Invalid scope.", status: 400 };
  }
  return { ok: true };
}

export function assertPathnameMatchesPayload(
  pathname: string,
  payload: BlobClientUploadPayload,
  sessionUserId: string,
): void {
  const prefix = expectedPathPrefix(payload, sessionUserId);
  if (!prefix) {
    throw new Error("Invalid path scope.");
  }
  if (!pathname.startsWith(prefix)) {
    throw new Error("Path does not match upload scope.");
  }
  const tail = pathname.slice(prefix.length);
  if (!isSafeStoredObjectKeyTail(tail)) {
    throw new Error("Invalid destination path.");
  }
}
