import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { autoArchiveExpiredDoneIssues } from "@/lib/issue-auto-archive";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  await autoArchiveExpiredDoneIssues();

  const issues = await prisma.issue.findMany({
    where: { archivedAt: null } as Record<string, null>,
    orderBy: { createdAt: "desc" },
    include: {
      project: true,
      customer: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(issues);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  const body = await request.json();
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
    assigneeId,
  } = body as Record<string, string | undefined>;

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

  const issue = await prisma.issue.create({
    data: {
      title: title.trim(),
      symptom: symptom.trim(),
      cause: (cause ?? "").trim(),
      solution: (solution ?? "").trim(),
      rndContact: (rndContact ?? "").trim(),
      projectId: project?.id ?? null,
      customerId: customer?.id ?? null,
      assigneeId: assigneeId || null,
      reporterId: session.user.id,
    },
    include: {
      project: true,
      customer: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true } },
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

  return NextResponse.json(issue, { status: 201 });
}
