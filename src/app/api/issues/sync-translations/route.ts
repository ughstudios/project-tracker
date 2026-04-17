import { auth } from "@/auth";
import { TABS_ISSUE_DATA } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { isTranslationConfigured } from "@/lib/issue-content-translation";
import { persistIssueTranslations } from "@/lib/issue-translation-persist";
import { NextResponse } from "next/server";

const MAX_IDS = 20;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_ISSUE_DATA);
  if (denied) return denied;

  if (!isTranslationConfigured()) {
    return NextResponse.json({ updates: [] as const, configured: false });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const idsRaw = (body as { issueIds?: unknown }).issueIds;
  if (!Array.isArray(idsRaw)) {
    return NextResponse.json({ error: "issueIds must be an array of strings." }, { status: 400 });
  }

  const issueIds = [...new Set(idsRaw.filter((x): x is string => typeof x === "string" && x.trim() !== ""))].slice(
    0,
    MAX_IDS,
  );

  if (issueIds.length === 0) {
    return NextResponse.json({ updates: [] as const, configured: true });
  }

  const updates = [];
  for (const id of issueIds) {
    try {
      const patch = await persistIssueTranslations(id);
      if (patch) updates.push(patch);
    } catch (e) {
      console.error("[sync-translations] issue", id, e);
    }
  }

  return NextResponse.json({ updates, configured: true });
}
