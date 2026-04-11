import { auth } from "@/auth";
import { TABS_LOGS } from "@/lib/employee-nav";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_LOGS);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const parsedSize = parseInt(searchParams.get("pageSize") ?? "25", 10);
  const pageSize = Math.min(Math.max(Number.isFinite(parsedSize) ? parsedSize : 25, 1), 50);

  try {
    const total = await prisma.auditLog.count();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    let page = 1;
    if (rawPage === "last") {
      page = totalPages;
    } else {
      const p = parseInt(rawPage ?? "1", 10);
      page = Number.isFinite(p) && p >= 1 ? Math.min(p, totalPages) : 1;
    }

    const skip = (page - 1) * pageSize;

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ logs, total, page, pageSize, totalPages });
  } catch {
    return NextResponse.json({ error: "Failed to load logs." }, { status: 500 });
  }
}

