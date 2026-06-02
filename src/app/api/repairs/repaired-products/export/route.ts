import { auth } from "@/auth";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { listRepairs } from "@/lib/repair-store";
import { repairedProductsToCsv } from "@/lib/repair-export";
import { withBomUtf8 } from "@/lib/csv";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  try {
    const repairedProducts = (await listRepairs())
      .filter((row) => row.status === "DONE")
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          a.model.localeCompare(b.model) ||
          a.serialNumber.localeCompare(b.serialNumber),
      );
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(
      withBomUtf8(repairedProductsToCsv(repairedProducts)),
      {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="repaired-products-${today}.csv"`,
          "Cache-Control": "private, no-store, must-revalidate",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to export repaired products." },
      { status: 500 },
    );
  }
}
