import { auth } from "@/auth";
import { TABS_REPORTS } from "@/lib/employee-nav";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { issuesToCsv, usersToCsv, workRecordsToCsv } from "@/lib/report-column-defs";
import { prisma } from "@/lib/prisma";
import { parseIssueCols, parseUserCols, parseWorkCols } from "@/lib/report-params";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

/** Admin-only: all issues, all work records, approved users — CSV strings for multiple downloads. */
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
  const issueCols = parseIssueCols(searchParams);
  const workCols = parseWorkCols(searchParams);
  const userCols = parseUserCols(searchParams);
  if (issueCols.length === 0 || workCols.length === 0 || userCols.length === 0) {
    return NextResponse.json(
      { error: "issueCols, workCols, and userCols must each list at least one valid column." },
      { status: 400 },
    );
  }

  try {
    const [issues, workRecords, users] = await Promise.all([
      prisma.issue.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          project: { select: { name: true } },
          customer: { select: { name: true } },
          assignee: { select: { name: true, email: true } },
          reporter: { select: { name: true, email: true } },
        },
      }),
      prisma.workRecord.findMany({
        orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.user.findMany({
        where: { approvalStatus: "APPROVED" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          approvalStatus: true,
        },
      }),
    ]);

    return NextResponse.json({
      files: {
        "issues-all.csv": issuesToCsv(issues, issueCols),
        "work-records-all.csv": workRecordsToCsv(workRecords, workCols),
        "users-approved.csv": usersToCsv(users, userCols),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build export." }, { status: 500 });
  }
}
