import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim() ?? "";
  if (!content) {
    return NextResponse.json({ error: "Note content is required." }, { status: 400 });
  }

  const note = await prisma.projectNote.create({
    data: {
      projectId,
      authorId: session.user.id,
      content,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "ProjectNote",
    entityId: note.id,
    action: "CREATE",
    description: `Note added to project ${projectId}.`,
  });

  return NextResponse.json(note, { status: 201 });
}

