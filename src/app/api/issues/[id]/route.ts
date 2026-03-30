import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        project: true,
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true } },
        threadEntries: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!issue) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }

    return NextResponse.json(issue);
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

  const { id } = await params;
  const existing = await prisma.issue.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;

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
  const assigneeId =
    body.assigneeId !== undefined
      ? body.assigneeId
        ? String(body.assigneeId)
        : null
      : existing.assigneeId;

  let projectId = existing.projectId;
  if (body.projectId !== undefined) {
    const nextPid = String(body.projectId);
    const proj = await prisma.project.findUnique({ where: { id: nextPid } });
    if (!proj) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    projectId = nextPid;
  }

  if (!title || !symptom) {
    return NextResponse.json(
      { error: "Title and symptom cannot be empty." },
      { status: 400 },
    );
  }

  const issue = await prisma.issue.update({
    where: { id },
    data: {
      title,
      symptom,
      cause,
      solution,
      rndContact,
      projectId,
      status,
      assigneeId,
      doneAt: status === "DONE" ? new Date() : null,
    },
    include: {
      project: true,
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true } },
      threadEntries: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: issue.id,
    action: "UPDATE",
    description: `Issue "${issue.title}" updated.`,
  });

  return NextResponse.json(issue);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.issue.findUnique({ where: { id }, select: { title: true } });
  await prisma.issue.delete({ where: { id } });
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: id,
    action: "DELETE",
    description: `Issue "${existing?.title ?? id}" deleted.`,
  });
  return NextResponse.json({ ok: true });
}
