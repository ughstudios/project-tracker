import { auth } from "@/auth";
import { TABS_DASHBOARD_ONLY } from "@/lib/employee-nav";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Aggregated work record stats for the dashboard (counts only — no titles or body text). Any signed-in user. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_DASHBOARD_ONLY);
  if (denied) return denied;

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  try {
    const [groupedByUser, recentForMonths] = await Promise.all([
      prisma.workRecord.groupBy({
        by: ["userId"],
        _count: { _all: true },
      }),
      prisma.workRecord.findMany({
        where: { workDate: { gte: since } },
        select: { workDate: true },
      }),
    ]);

    const userIds = groupedByUser.map((g) => g.userId);
    const users =
      userIds.length === 0
        ? []
        : await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const byUser = groupedByUser
      .map((g) => ({
        userId: g.userId,
        name: nameById.get(g.userId) ?? g.userId,
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const monthCounts = new Map<string, number>();
    for (const r of recentForMonths) {
      const d = r.workDate;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }

    const now = new Date();
    const byMonth: { monthKey: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      byMonth.push({ monthKey, count: monthCounts.get(monthKey) ?? 0 });
    }

    return NextResponse.json({ byUser, byMonth });
  } catch {
    return NextResponse.json({ error: "Failed to load work record summary." }, { status: 500 });
  }
}
