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
    projectId,
    projectName,
    product,
    symptom,
    cause,
    solution,
    rndContact,
    assigneeId,
  } = body as Record<string, string>;

  if (!title || !symptom || (!projectId && (!projectName || !product))) {
    return NextResponse.json(
      {
        error:
          "Title and symptom are required, plus either an existing project or project name/product.",
      },
      { status: 400 },
    );
  }

  let project: { id: string; name: string; archivedAt?: Date | null } | null = null;
  if (projectId) {
    project = (await prisma.project.findUnique({ where: { id: projectId } })) as
      | { id: string; name: string; archivedAt?: Date | null }
      | null;
  } else {
    const adHocCustomer = await prisma.customer.upsert({
      where: { name: "Ad hoc" },
      update: {},
      create: { name: "Ad hoc" },
    });
    project = (await prisma.project.upsert({
      where: { name: projectName.trim() },
      update: { product: product.trim() },
      create: {
        name: projectName.trim(),
        product: product.trim(),
        customerId: adHocCustomer.id,
      },
    })) as { id: string; name: string; archivedAt?: Date | null };
  }

  if (!project) {
    return NextResponse.json({ error: "Selected project not found." }, { status: 404 });
  }
  if (project.archivedAt) {
    return NextResponse.json({ error: "Selected project is archived." }, { status: 400 });
  }

  const issue = await prisma.issue.create({
    data: {
      title: title.trim(),
      symptom: symptom.trim(),
      cause: (cause ?? "").trim(),
      solution: (solution ?? "").trim(),
      rndContact: (rndContact ?? "").trim(),
      projectId: project.id,
      assigneeId: assigneeId || null,
      reporterId: session.user.id,
    },
    include: {
      project: true,
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true } },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: issue.id,
    action: "CREATE",
    description: `Issue "${issue.title}" created in project ${issue.project.name}.`,
  });

  return NextResponse.json(issue, { status: 201 });
}
