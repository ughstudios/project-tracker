import { auth } from "@/auth";
import { TABS_PRODUCTS_CATALOG } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { PRODUCT_GROUPS } from "@/lib/product-catalog";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_PRODUCTS_CATALOG);
  if (denied) return denied;

  return NextResponse.json({
    groups: PRODUCT_GROUPS,
    flat: PRODUCT_GROUPS.flatMap((g) => g.items),
  });
}

