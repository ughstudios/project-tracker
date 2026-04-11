import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_WORK_RECORDS_PAGE } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

function parseWorkDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_WORK_RECORDS_PAGE);
  if (denied) return denied;

  const isAdmin = isPrivilegedAdmin(session.user.role);
  const { searchParams } = new URL(request.url);
  const forUserId = searchParams.get("forUserId");

  let where: { userId?: string } = {};
  if (isAdmin) {
    if (forUserId) where = { userId: forUserId };
  } else {
    where = { userId: session.user.id };
  }

  const rawPage = searchParams.get("page");
  const parsedSize = parseInt(searchParams.get("pageSize") ?? "10", 10);
  const pageSize = Math.min(Math.max(Number.isFinite(parsedSize) ? parsedSize : 10, 1), 50);

  try {
    const total = await prisma.workRecord.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    let page = 1;
    if (rawPage === "last") {
      page = totalPages;
    } else {
      const p = parseInt(rawPage ?? "1", 10);
      page = Number.isFinite(p) && p >= 1 ? Math.min(p, totalPages) : 1;
    }

    const skip = (page - 1) * pageSize;

    const records = await prisma.workRecord.findMany({
      where,
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ records, total, page, pageSize, totalPages });
  } catch {
    return NextResponse.json({ error: "Failed to load work records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_WORK_RECORDS_PAGE);
  if (denied) return denied;

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

  const workDate = parseWorkDate(b.workDate);
  if (!workDate) {
    return NextResponse.json({ error: "workDate is required (ISO date)." }, { status: 400 });
  }

  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  const title = typeof b.title === "string" ? b.title.trim() : "";

  try {
    const created = await prisma.workRecord.create({
      data: {
        userId: session.user.id,
        workDate,
        title,
        content,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      entityType: "WorkRecord",
      entityId: created.id,
      action: "CREATE",
      description: `Work record for ${workDate.toISOString().slice(0, 10)}.`,
    });

    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "Failed to create work record." }, { status: 500 });
  }
}
