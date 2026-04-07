import { auth } from "@/auth";
import { withBomUtf8 } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { workRecordsToCsv } from "@/lib/report-csv-builders";
import { parseDateUtcDay } from "@/lib/report-dates";
import { parseDetail, parseReportQuery } from "@/lib/report-params";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

function endOfUtcDay(start: Date): Date {
  const d = new Date(start);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = isPrivilegedAdmin(session.user.role);
  const { searchParams } = new URL(request.url);
  const { format } = parseReportQuery(searchParams);
  const detail = parseDetail(searchParams, "workDetail", "standard");
  const fromStr = searchParams.get("from") ?? "";
  const toStr = searchParams.get("to") ?? "";
  const fromDay = parseDateUtcDay(fromStr);
  const toDay = parseDateUtcDay(toStr);
  if (!fromDay || !toDay || fromDay.getTime() > toDay.getTime()) {
    return NextResponse.json(
      { error: "Query from and to are required (YYYY-MM-DD) and from must be ≤ to." },
      { status: 400 },
    );
  }

  const from = fromDay;
  const to = endOfUtcDay(toDay);

  const forUserId = searchParams.get("forUserId")?.trim() ?? "";
  const allUsers = forUserId === "__all__";

  let where: { userId?: string; workDate: { gte: Date; lte: Date } };
  if (isAdmin && allUsers) {
    where = { workDate: { gte: from, lte: to } };
  } else if (isAdmin && forUserId) {
    where = { userId: forUserId, workDate: { gte: from, lte: to } };
  } else {
    where = { userId: session.user.id, workDate: { gte: from, lte: to } };
  }

  try {
    const records = await prisma.workRecord.findMany({
      where,
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const csv = workRecordsToCsv(records, { format, detail });
    const slug = `${fromStr.trim()}_to_${toStr.trim()}`.replace(/[^\d_-]/g, "");
    return new NextResponse(withBomUtf8(csv), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="work-records-${slug}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build report." }, { status: 500 });
  }
}
