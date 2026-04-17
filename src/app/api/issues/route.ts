import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import {
  issueAssignmentsWithUsersInclude,
  issueRowToApiShape,
  resolveAssigneeIdsForCreate,
} from "@/lib/issue-assignees";
import { translateIssueContent } from "@/lib/issue-content-translation";
import { autoArchiveExpiredDoneIssues } from "@/lib/issue-auto-archive";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  await autoArchiveExpiredDoneIssues();

  const { searchParams } = new URL(request.url);
  const withArchived =
    searchParams.get("withArchived") === "1" || searchParams.get("withArchived") === "true";

  const issues = await prisma.issue.findMany({
    where: withArchived ? undefined : { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      project: true,
      customer: { select: { id: true, name: true } },
      reporter: { select: { id: true, name: true } },
      ...issueAssignmentsWithUsersInclude,
    },
  });

  return NextResponse.json(issues.map(issueRowToApiShape));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown>;
  const {
    title,
    projectId: rawProjectId,
    customerId: rawCustomerId,
    projectName,
    product,
    symptom,
    cause,
    solution,
    rndContact,
  } = body as Record<string, string | undefined>;

  if ("assigneeIds" in body && body.assigneeIds !== undefined && !Array.isArray(body.assigneeIds)) {
    return NextResponse.json({ error: "assigneeIds must be an array of user id strings." }, { status: 400 });
  }

  const assigneeIds = resolveAssigneeIdsForCreate(body);

  const projectIdStr =
    typeof rawProjectId === "string" && rawProjectId.trim() ? rawProjectId.trim() : "";
  const customerIdStr =
    typeof rawCustomerId === "string" && rawCustomerId.trim() ? rawCustomerId.trim() : "";

  if (!title?.trim() || !symptom?.trim()) {
    return NextResponse.json(
      { error: "Title and symptom are required." },
      { status: 400 },
    );
  }

  const adHocRequested = !!(projectName?.trim() && product?.trim());

  let project: { id: string; name: string; archivedAt?: Date | null } | null = null;

  if (projectIdStr) {
    project = await prisma.project.findUnique({ where: { id: projectIdStr } });
  } else if (adHocRequested) {
    const adHocCustomer = await prisma.customer.upsert({
      where: { name: "Ad hoc" },
      update: {},
      create: { name: "Ad hoc" },
    });
    project = await prisma.project.upsert({
      where: { name: projectName!.trim() },
      update: { product: product!.trim() },
      create: {
        name: projectName!.trim(),
        product: product!.trim(),
        customerId: adHocCustomer.id,
      },
    });
  }

  if (projectIdStr && !project) {
    return NextResponse.json({ error: "Selected project not found." }, { status: 404 });
  }
  if (project?.archivedAt) {
    return NextResponse.json({ error: "Selected project is archived." }, { status: 400 });
  }

  let customer: { id: string; name: string; archivedAt: Date | null } | null = null;
  if (customerIdStr) {
    customer = await prisma.customer.findUnique({ where: { id: customerIdStr } });
    if (!customer) {
      return NextResponse.json({ error: "Selected customer not found." }, { status: 404 });
    }
    if (customer.archivedAt) {
      return NextResponse.json({ error: "Selected customer is archived." }, { status: 400 });
    }
  }

  if (assigneeIds.length > 0) {
    const n = await prisma.user.count({ where: { id: { in: assigneeIds } } });
    if (n !== assigneeIds.length) {
      return NextResponse.json({ error: "One or more assignees were not found." }, { status: 404 });
    }
  }

  const translatedContent = await translateIssueContent({
    title: title.trim(),
    symptom: symptom.trim(),
    cause: (cause ?? "").trim(),
    solution: (solution ?? "").trim(),
  });

  const issue = await prisma.issue.create({
    data: {
      title: title.trim(),
      titleTranslated: translatedContent.titleTranslated,
      symptom: symptom.trim(),
      symptomTranslated: translatedContent.symptomTranslated,
      cause: (cause ?? "").trim(),
      causeTranslated: translatedContent.causeTranslated,
      solution: (solution ?? "").trim(),
      solutionTranslated: translatedContent.solutionTranslated,
      contentLanguage: translatedContent.contentLanguage,
      rndContact: (rndContact ?? "").trim(),
      projectId: project?.id ?? null,
      customerId: customer?.id ?? null,
      reporterId: session.user.id,
      assignments:
        assigneeIds.length > 0
          ? { create: assigneeIds.map((userId) => ({ userId })) }
          : undefined,
    },
    include: {
      project: true,
      customer: { select: { id: true, name: true } },
      reporter: { select: { id: true, name: true } },
      ...issueAssignmentsWithUsersInclude,
    },
  });

  const linkLabel =
    [issue.project?.name, issue.customer?.name].filter(Boolean).join(" · ") || "no link";
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: issue.id,
    action: "CREATE",
    description: `Issue "${issue.title}" created (${linkLabel}).`,
  });

  return NextResponse.json(issueRowToApiShape(issue), { status: 201 });
}
