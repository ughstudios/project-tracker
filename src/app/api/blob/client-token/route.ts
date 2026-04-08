import { auth } from "@/auth";
import {
  getBlobReadWriteToken,
  isBlobStorageEnabled,
  vercelUploadsNotReadyResponse,
} from "@/lib/file-storage";
import { maxClientBlobUploadBytes, storedFileName } from "@/lib/issue-files";
import { prisma } from "@/lib/prisma";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = vercelUploadsNotReadyResponse();
  if (blocked) return blocked;
  if (!isBlobStorageEnabled()) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const scope = body.scope;
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

  if (!fileName.trim()) {
    return NextResponse.json({ error: "fileName is required." }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize < 1) {
    return NextResponse.json({ error: "fileSize is required." }, { status: 400 });
  }
  const maxB = maxClientBlobUploadBytes();
  if (fileSize > maxB) {
    return NextResponse.json({ error: "File is too large." }, { status: 400 });
  }

  const stored = storedFileName(fileName);
  let pathname: string;

  if (scope === "project") {
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, archivedAt: true },
    });
    if (!project || project.archivedAt) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    pathname = `projects/${projectId}/${stored}`;
  } else if (scope === "customer") {
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    if (!customerId) {
      return NextResponse.json({ error: "customerId is required." }, { status: 400 });
    }
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, archivedAt: true },
    });
    if (!customer || customer.archivedAt) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }
    pathname = `customers/${customerId}/${stored}`;
  } else if (scope === "issue") {
    const issueId = typeof body.issueId === "string" ? body.issueId : "";
    if (!issueId) {
      return NextResponse.json({ error: "issueId is required." }, { status: 400 });
    }
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, archivedAt: true },
    });
    if (!issue || issue.archivedAt) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }
    pathname = `issues/${issueId}/${stored}`;
  } else if (scope === "thread") {
    const issueId = typeof body.issueId === "string" ? body.issueId : "";
    const threadEntryId = typeof body.threadEntryId === "string" ? body.threadEntryId : "";
    if (!issueId || !threadEntryId) {
      return NextResponse.json({ error: "issueId and threadEntryId are required." }, { status: 400 });
    }
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, archivedAt: true },
    });
    if (!issue || issue.archivedAt) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }
    const entry = await prisma.issueThreadEntry.findFirst({
      where: { id: threadEntryId, issueId },
      select: { id: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "Thread entry not found." }, { status: 404 });
    }
    pathname = `issues/${issueId}/thread/${threadEntryId}/${stored}`;
  } else {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }

  const rw = getBlobReadWriteToken();
  if (!rw) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 503 });
  }

  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    token: rw,
    addRandomSuffix: false,
    maximumSizeInBytes: maxB,
  });

  return NextResponse.json({ clientToken, pathname });
}
