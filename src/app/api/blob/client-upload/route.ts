import { auth } from "@/auth";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { maxClientBlobUploadBytes } from "@/lib/issue-files";
import { prisma } from "@/lib/prisma";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export type BlobClientUploadPayload = {
  scope: "project" | "customer" | "issue" | "thread";
  projectId?: string;
  customerId?: string;
  issueId?: string;
  threadEntryId?: string;
  originalFileName: string;
};

function expectedPathPrefix(payload: BlobClientUploadPayload): string | null {
  switch (payload.scope) {
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

function parseClientPayload(raw: string | null): BlobClientUploadPayload | { error: string } {
  if (raw == null || raw === "") {
    return { error: "clientPayload is required." };
  }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const scope = o.scope;
    if (
      scope !== "project" &&
      scope !== "customer" &&
      scope !== "issue" &&
      scope !== "thread"
    ) {
      return { error: "Invalid scope." };
    }
    const originalFileName =
      typeof o.originalFileName === "string" ? o.originalFileName.trim() : "";
    if (!originalFileName) {
      return { error: "originalFileName is required." };
    }
    const base: BlobClientUploadPayload = {
      scope,
      originalFileName,
      projectId: typeof o.projectId === "string" ? o.projectId : undefined,
      customerId: typeof o.customerId === "string" ? o.customerId : undefined,
      issueId: typeof o.issueId === "string" ? o.issueId : undefined,
      threadEntryId: typeof o.threadEntryId === "string" ? o.threadEntryId : undefined,
    };
    return base;
  } catch {
    return { error: "Invalid clientPayload." };
  }
}

function isSafeStoredObjectKeyTail(tail: string): boolean {
  if (!tail || tail.length > 512) return false;
  if (tail.includes("/") || tail.includes("\\") || tail.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(tail);
}

async function authorizePayload(
  payload: BlobClientUploadPayload,
): Promise<{ ok: true } | { error: string; status: number }> {
  switch (payload.scope) {
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

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = vercelUploadsNotReadyResponse();
  if (blocked) return blocked;
  if (!isBlobStorageEnabled()) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const rw = getBlobReadWriteToken();
  if (!rw) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      token: rw,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const parsed = parseClientPayload(clientPayloadRaw);
        if ("error" in parsed) {
          throw new Error(parsed.error);
        }
        const authz = await authorizePayload(parsed);
        if ("error" in authz) {
          throw new Error(authz.error);
        }
        const prefix = expectedPathPrefix(parsed);
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

        const maxB = maxClientBlobUploadBytes();

        return {
          addRandomSuffix: false,
          maximumSizeInBytes: maxB,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
