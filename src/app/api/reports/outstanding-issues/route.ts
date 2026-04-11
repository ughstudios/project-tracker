import { auth } from "@/auth";
import { TABS_REPORTS } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { issuesToCsv } from "@/lib/report-column-defs";
import { withBomUtf8 } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { parseYearMonth } from "@/lib/report-dates";
import { parseIssueCols } from "@/lib/report-params";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * Outstanding issues as of the end of a calendar month (UTC): not yet archived and not yet
 * marked done by that time; issue must have been created on or before month end.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_REPORTS);
  if (denied) return denied;
  if (!isPrivilegedAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? "";
  const parsed = parseYearMonth(month);
  if (!parsed) {
    return NextResponse.json({ error: "Query month is required (YYYY-MM)." }, { status: 400 });
  }
  const { end } = parsed;

  const issueCols = parseIssueCols(searchParams);
  if (issueCols.length === 0) {
    return NextResponse.json({ error: "At least one issue column is required (issueCols)." }, { status: 400 });
  }

  try {
    const issues = await prisma.issue.findMany({
      where: {
        createdAt: { lte: end },
        AND: [
          { OR: [{ archivedAt: null }, { archivedAt: { gt: end } }] },
          { OR: [{ doneAt: null }, { doneAt: { gt: end } }] },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        project: { select: { name: true } },
        customer: { select: { name: true } },
        assignee: { select: { name: true, email: true } },
        reporter: { select: { name: true, email: true } },
      },
    });

    const csv = issuesToCsv(issues, issueCols);
    const safeMonth = month.trim().replace(/[^\d-]/g, "") || "report";
    return new NextResponse(withBomUtf8(csv), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="outstanding-issues-${safeMonth}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build report." }, { status: 500 });
  }
}
