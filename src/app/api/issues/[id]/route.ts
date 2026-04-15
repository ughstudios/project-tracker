import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import {
  issueAssignmentsWithUsersInclude,
  issueRowToApiShape,
  resolveAssigneeIdsForPatch,
} from "@/lib/issue-assignees";
import { translateIssueContent } from "@/lib/issue-content-translation";
import { autoArchiveExpiredDoneIssue } from "@/lib/issue-auto-archive";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const issueDetailInclude = {
  project: true,
  customer: { select: { id: true, name: true } },
  reporter: { select: { id: true, name: true } },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    include: { uploader: { select: { id: true, name: true, email: true } } },
  },
  ...issueAssignmentsWithUsersInclude,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const { id } = await params;
  await autoArchiveExpiredDoneIssue(id);
  try {
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: issueDetailInclude,
    });

    if (!issue) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }

    return NextResponse.json(issueRowToApiShape(issue), {
      headers: { "Cache-Control": "private, no-store, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load issue." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const { id } = await params;
  await autoArchiveExpiredDoneIssue(id);
  const existing = await prisma.issue.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  if (body.archive === true) {
    const archivedIssue = await prisma.issue.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true, title: true },
    });
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "Issue",
      entityId: archivedIssue.id,
      action: "ARCHIVE",
      description: `Issue "${archivedIssue.title}" archived.`,
    });
    return NextResponse.json({ ok: true });
  }

  if ("assigneeIds" in body && body.assigneeIds !== undefined && !Array.isArray(body.assigneeIds)) {
    return NextResponse.json(
      { error: "assigneeIds must be an array of user id strings." },
      { status: 400 },
    );
  }

  const title =
    typeof body.title === "string" ? body.title.trim() : existing.title;
  const symptom =
    typeof body.symptom === "string" ? body.symptom.trim() : existing.symptom;
  const cause =
    typeof body.cause === "string" ? body.cause.trim() : existing.cause;
  const solution =
    typeof body.solution === "string" ? body.solution.trim() : existing.solution;
  const rndContact =
    typeof body.rndContact === "string" ? body.rndContact.trim() : existing.rndContact;
  const status =
    body.status !== undefined ? String(body.status) : existing.status;

  const assigneePatch = resolveAssigneeIdsForPatch(body);

  let projectId: string | null = existing.projectId;
  let customerId: string | null = existing.customerId;

  if (body.projectId !== undefined) {
    if (body.projectId === null || body.projectId === "") {
      projectId = null;
    } else {
      const nextPid = String(body.projectId);
      const proj = await prisma.project.findUnique({ where: { id: nextPid } });
      if (!proj) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      if (proj.archivedAt) {
        return NextResponse.json({ error: "Selected project is archived." }, { status: 400 });
      }
      projectId = nextPid;
    }
  }

  if (body.customerId !== undefined) {
    if (body.customerId === null || body.customerId === "") {
      customerId = null;
    } else {
      const nextCid = String(body.customerId);
      const cust = await prisma.customer.findUnique({ where: { id: nextCid } });
      if (!cust) {
        return NextResponse.json({ error: "Customer not found." }, { status: 404 });
      }
      if (cust.archivedAt) {
        return NextResponse.json({ error: "Selected customer is archived." }, { status: 400 });
      }
      customerId = nextCid;
    }
  }

  if (!title || !symptom) {
    return NextResponse.json(
      { error: "Title and symptom cannot be empty." },
      { status: 400 },
    );
  }

  if (assigneePatch !== "unchanged") {
    const n = await prisma.user.count({ where: { id: { in: assigneePatch } } });
    if (n !== assigneePatch.length) {
      return NextResponse.json({ error: "One or more assignees were not found." }, { status: 404 });
    }
  }

  const contentChanged =
    title !== existing.title ||
    symptom !== existing.symptom ||
    cause !== existing.cause ||
    solution !== existing.solution;

  const translatedContent = contentChanged
    ? await translateIssueContent({ title, symptom, cause, solution })
    : {
        contentLanguage: existing.contentLanguage,
        titleTranslated: existing.titleTranslated,
        symptomTranslated: existing.symptomTranslated,
        causeTranslated: existing.causeTranslated,
        solutionTranslated: existing.solutionTranslated,
      };

  await prisma.$transaction(async (tx) => {
    await tx.issue.update({
      where: { id },
      data: {
        title,
        titleTranslated: translatedContent.titleTranslated,
        symptom,
        symptomTranslated: translatedContent.symptomTranslated,
        cause,
        causeTranslated: translatedContent.causeTranslated,
        solution,
        solutionTranslated: translatedContent.solutionTranslated,
        contentLanguage: translatedContent.contentLanguage,
        rndContact,
        projectId,
        customerId,
        status,
        doneAt: status === "DONE" ? new Date() : null,
      },
    });
    if (assigneePatch !== "unchanged") {
      await tx.issueAssignment.deleteMany({ where: { issueId: id } });
      if (assigneePatch.length > 0) {
        await tx.issueAssignment.createMany({
          data: assigneePatch.map((userId) => ({ issueId: id, userId })),
        });
      }
    }
  });

  const issue = await prisma.issue.findUniqueOrThrow({
    where: { id },
    include: issueDetailInclude,
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: issue.id,
    action: "UPDATE",
    description: `Issue "${issue.title}" updated.`,
  });

  return NextResponse.json(issueRowToApiShape(issue));
}
