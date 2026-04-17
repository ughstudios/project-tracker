import {
  employeeNavAllowsAny,
  mergeEmployeeNavAccess,
  parseEmployeeNavAccessJson,
  TABS_ISSUE_DATA,
  TABS_LOGS,
  TABS_WORK_RECORDS_PAGE,
  type EmployeeNavTabId,
} from "@/lib/employee-nav-shared";
import { getEmployeeNavAccessRow } from "@/lib/employee-nav";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";

function excerpt(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Read-only summary of DB entities the signed-in user is allowed to see
 * (same coarse gates as main nav + work-record ownership for non-admins).
 */
export async function buildAiKnowledgeSnapshot(params: {
  userId: string;
  role: string | null | undefined;
  userName: string | null | undefined;
}): Promise<Record<string, unknown>> {
  const { userId, role, userName } = params;
  const admin = isPrivilegedAdmin(role);

  const nav: Record<EmployeeNavTabId, boolean> = admin
    ? mergeEmployeeNavAccess({})
    : mergeEmployeeNavAccess(
        parseEmployeeNavAccessJson((await getEmployeeNavAccessRow()).employeeNavAccess),
      );

  const scopes: string[] = [];
  const out: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    viewer: {
      userId,
      displayName: userName ?? null,
      isAdmin: admin,
    },
    scopes,
    note:
      "This JSON is the only database-derived context you may use. If a topic is absent from scopes or lists, the user cannot see that data — say so briefly.",
  };

  if (employeeNavAllowsAny(nav, TABS_ISSUE_DATA)) {
    scopes.push("issues");
    const issues = await prisma.issue.findMany({
      take: 120,
      orderBy: { updatedAt: "desc" },
      include: {
        project: { select: { name: true } },
        customer: { select: { name: true } },
        assignments: { include: { user: { select: { name: true } } } },
      },
    });
    out.issues = issues.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      symptomExcerpt: excerpt(i.symptom, 320),
      causeExcerpt: excerpt(i.cause, 240),
      solutionExcerpt: excerpt(i.solution, 240),
      rndContact: excerpt(i.rndContact, 120),
      project: i.project?.name ?? null,
      customer: i.customer?.name ?? null,
      assignees: i.assignments.map((a) => a.user.name).filter(Boolean),
      archived: Boolean(i.archivedAt),
    }));
  }

  if (nav.projects !== false) {
    scopes.push("projects");
    const projects = await prisma.project.findMany({
      take: 100,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        product: true,
        archivedAt: true,
        customer: { select: { name: true } },
      },
    });
    out.projects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      product: p.product,
      customer: p.customer.name,
      archived: Boolean(p.archivedAt),
    }));
  }

  if (nav.customers !== false) {
    scopes.push("customers");
    const customers = await prisma.customer.findMany({
      take: 150,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, archivedAt: true },
    });
    out.customers = customers.map((c) => ({
      id: c.id,
      name: c.name,
      archived: Boolean(c.archivedAt),
    }));
  }

  if (employeeNavAllowsAny(nav, TABS_WORK_RECORDS_PAGE)) {
    scopes.push("workRecords");
    const where = admin ? {} : { userId };
    const records = await prisma.workRecord.findMany({
      where,
      take: admin ? 50 : 40,
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      include: { user: { select: { id: true, name: true } } },
    });
    out.workRecords = records.map((r) => ({
      id: r.id,
      workDate: r.workDate.toISOString().slice(0, 10),
      authorId: r.user.id,
      authorName: r.user.name,
      title: r.title,
      contentExcerpt: excerpt(r.content, admin ? 500 : 600),
    }));
    if (!admin) {
      out.workRecordsAccess = "own_records_only";
    }
  }

  if (nav.inventory !== false) {
    scopes.push("inventory");
    const lines = await prisma.warehouseStockLine.findMany({
      take: 200,
      orderBy: { updatedAt: "desc" },
      select: {
        kind: true,
        model: true,
        firmware: true,
        receiverVersion: true,
        category: true,
        quantity: true,
        location: true,
      },
    });
    out.inventory = lines;
  }

  if (employeeNavAllowsAny(nav, TABS_LOGS)) {
    scopes.push("auditLogs");
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        entityType: true,
        entityId: true,
        action: true,
        description: true,
        actor: { select: { name: true, email: true } },
      },
    });
    out.auditLogs = logs.map((l) => ({
      at: l.createdAt.toISOString(),
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      description: excerpt(l.description, 280),
      actor: l.actor?.name ?? l.actor?.email ?? null,
    }));
  }

  if (nav.reports !== false) {
    scopes.push("reportsArea");
    out.reportsHint =
      "User can open the Reports UI; this snapshot does not embed full report exports — infer only from issues/projects above when present.";
  }

  return out;
}
