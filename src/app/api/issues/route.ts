import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issues = await prisma.issue.findMany({
    where: { archivedAt: null } as Record<string, null>,
    orderBy: { createdAt: "desc" },
    include: {
      project: true,
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

  const body = await request.json();
  const {
    title,
    projectId: rawProjectId,
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

  if (!title?.trim() || !symptom?.trim()) {
    return NextResponse.json(
      { error: "Title and symptom are required." },
      { status: 400 },
    );
  }

  let project: { id: string; name: string; archivedAt?: Date | null } | null = null;

  if (projectIdStr) {
    project = await prisma.project.findUnique({ where: { id: projectIdStr } });
  } else if (projectName?.trim() && product?.trim()) {
    const adHocCustomer = await prisma.customer.upsert({
      where: { name: "Ad hoc" },
      update: {},
      create: { name: "Ad hoc" },
    });
    project = await prisma.project.upsert({
      where: { name: projectName.trim() },
      update: { product: product.trim() },
      create: {
        name: projectName.trim(),
        product: product.trim(),
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

  const issue = await prisma.issue.create({
    data: {
      title: title.trim(),
      symptom: symptom.trim(),
      cause: (cause ?? "").trim(),
      solution: (solution ?? "").trim(),
      rndContact: (rndContact ?? "").trim(),
      projectId: project?.id ?? null,
      assigneeId: assigneeId || null,
      reporterId: session.user.id,
    },
    include: {
      project: true,
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true } },
    },
  });

  const projectLabel = issue.project?.name ?? "no project";
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: issue.id,
    action: "CREATE",
    description: `Issue "${issue.title}" created (${projectLabel}).`,
  });

  return NextResponse.json(issue, { status: 201 });
}
