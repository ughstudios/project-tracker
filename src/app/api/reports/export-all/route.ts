import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { issuesToCsv, usersToCsv, workRecordsToCsv } from "@/lib/report-csv-builders";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

/** Admin-only: all issues, all work records, approved users — CSV strings for multiple downloads. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivilegedAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        "issues-all.csv": issuesToCsv(issues),
        "work-records-all.csv": workRecordsToCsv(workRecords),
        "users-approved.csv": usersToCsv(users),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build export." }, { status: 500 });
  }
}
