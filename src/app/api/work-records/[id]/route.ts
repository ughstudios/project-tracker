import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseWorkDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function canModify(session: { user: { id: string; role: string } }, recordUserId: string) {
  if (session.user.role === "ADMIN") return true;
  return recordUserId === session.user.id;
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
  const existing = await prisma.workRecord.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!canModify(session, existing.userId)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as {
    workDate?: unknown;
    title?: unknown;
    content?: unknown;
  };

  const data: { workDate?: Date; title?: string; content?: string } = {};

  if (b.workDate !== undefined) {
    const workDate = parseWorkDate(b.workDate);
    if (!workDate) {
      return NextResponse.json({ error: "Invalid workDate." }, { status: 400 });
    }
    data.workDate = workDate;
  }

  if (b.title !== undefined) {
    data.title = typeof b.title === "string" ? b.title.trim() : "";
  }

  if (b.content !== undefined) {
    const content = typeof b.content === "string" ? b.content.trim() : "";
    if (!content) {
      return NextResponse.json({ error: "content cannot be empty." }, { status: 400 });
    }
    data.content = content;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.workRecord.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      entityType: "WorkRecord",
      entityId: id,
      action: "UPDATE",
      description: "Work record updated.",
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update work record." }, { status: 500 });
  }
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
  const existing = await prisma.workRecord.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!canModify(session, existing.userId)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    await prisma.workRecord.delete({ where: { id } });

    await writeAuditLog({
      actorId: session.user.id,
      entityType: "WorkRecord",
      entityId: id,
      action: "DELETE",
      description: "Work record deleted.",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete work record." }, { status: 500 });
  }
}
