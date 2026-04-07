import { auth } from "@/auth";
import { withBomUtf8 } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { issuesToCsv } from "@/lib/report-csv-builders";
import { parseYearMonth } from "@/lib/report-dates";
import { parseDetail, parseReportQuery } from "@/lib/report-params";
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

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? "";
  const parsed = parseYearMonth(month);
  if (!parsed) {
    return NextResponse.json({ error: "Query month is required (YYYY-MM)." }, { status: 400 });
  }
  const { end } = parsed;

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

    const { format } = parseReportQuery(searchParams);
    const detail = parseDetail(searchParams, "issueDetail", "extended");
    const csv = issuesToCsv(issues, { format, detail });
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
