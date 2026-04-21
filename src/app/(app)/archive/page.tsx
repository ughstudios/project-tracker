import { auth } from "@/auth";
import { ArchiveIssuesSection } from "@/components/archive-issues-section";
import { getServerTranslator } from "@/i18n/server";
import { writeAuditLog } from "@/lib/audit";
import { autoArchiveExpiredDoneIssues } from "@/lib/issue-auto-archive";
import { autoArchiveClosedPublicCustomerRequests } from "@/lib/public-customer-request-auto-archive";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

async function unarchiveCustomer(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !isPrivilegedAdmin(session.user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const customer = await prisma.customer.update({
    where: { id },
    data: { archivedAt: null },
    select: { id: true, name: true },
  });
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Customer",
    entityId: customer.id,
    action: "UNARCHIVE",
    description: `Customer "${customer.name}" unarchived.`,
  });
  revalidatePath("/archive");
}

async function unarchiveProject(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !isPrivilegedAdmin(session.user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const project = await prisma.project.update({
    where: { id },
    data: { archivedAt: null },
    select: { id: true, name: true },
  });
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Project",
    entityId: project.id,
    action: "UNARCHIVE",
    description: `Project "${project.name}" unarchived.`,
  });
  revalidatePath("/archive");
}

async function unarchiveIssue(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !isPrivilegedAdmin(session.user.role)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const existing = await prisma.issue.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });
  if (!existing) return;

  const issue = await prisma.issue.update({
    where: { id },
    data: {
      archivedAt: null,
      ...(existing.status === "DONE" ? { doneAt: new Date() } : {}),
    },
    select: { id: true, title: true },
  });
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Issue",
    entityId: issue.id,
    action: "UNARCHIVE",
    description: `Issue "${issue.title}" unarchived.`,
  });
  revalidatePath("/archive");
}

export default async function ArchivePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const staffAdmin = isPrivilegedAdmin(session.user.role);
  const t = await getServerTranslator();

  await autoArchiveExpiredDoneIssues();
  await autoArchiveClosedPublicCustomerRequests();

  const [customers, projects, issues, archivedFormRequests] = await Promise.all([
    prisma.customer.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: { id: true, name: true, archivedAt: true },
    }),
    prisma.project.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: {
        id: true,
        name: true,
        product: true,
        archivedAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.issue.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      select: {
        id: true,
        title: true,
        titleTranslated: true,
        status: true,
        symptom: true,
        symptomTranslated: true,
        cause: true,
        causeTranslated: true,
        solution: true,
        solutionTranslated: true,
        contentLanguage: true,
        rndContact: true,
        archivedAt: true,
        project: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.publicCustomerRequest.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      take: 100,
      select: {
        submissionId: true,
        kind: true,
        status: true,
        archivedAt: true,
        assignee: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header className="panel-surface rounded-xl p-4">
        <h1 className="text-xl font-semibold">{t("archive.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("archive.subtitle")}</p>
      </header>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold">{t("archive.customers")}</h2>
        {customers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("archive.noCustomers")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/customers/${c.id}`}
                  className="underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700"
                >
                  {c.name} - {c.archivedAt ? new Date(c.archivedAt).toLocaleString() : ""}
                </Link>
                {staffAdmin ? (
                  <form action={unarchiveCustomer}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800"
                    >
                      {t("common.unarchive")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold">{t("archive.projects")}</h2>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("archive.noProjects")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700"
                >
                  {p.name} ({p.product}) - {p.customer.name} -{" "}
                  {p.archivedAt ? new Date(p.archivedAt).toLocaleString() : ""}
                </Link>
                {staffAdmin ? (
                  <form action={unarchiveProject}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800"
                    >
                      {t("common.unarchive")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Pending form requests (archived)</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Public calibration and processor RMA submissions that were archived manually or automatically 24 hours after
          being marked closed.
        </p>
        {archivedFormRequests.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {archivedFormRequests.map((r) => (
              <li
                key={r.submissionId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
              >
                <span className="text-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">
                    {r.kind === "CALIBRATION" ? "Calibration" : "Processor RMA"}
                  </span>
                  <span className="mx-1 text-zinc-400">·</span>
                  <span className="font-mono text-xs">{r.submissionId.slice(0, 8)}</span>
                  <span className="mx-1 text-zinc-400">·</span>
                  {r.status}
                  {r.assignee ? (
                    <>
                      <span className="mx-1 text-zinc-400">·</span>
                      assigned to {r.assignee.name}
                    </>
                  ) : null}
                  <span className="mx-1 text-zinc-400">·</span>
                  archived {r.archivedAt ? new Date(r.archivedAt).toLocaleString() : ""}
                </span>
                <Link
                  href="/pending-customer-requests"
                  className="shrink-0 text-xs text-sky-700 underline decoration-sky-400 underline-offset-2 dark:text-sky-300"
                >
                  Active queue
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-surface rounded-xl p-4">
        <ArchiveIssuesSection
          issues={issues.map((i) => ({
            id: i.id,
            title: i.title,
            titleTranslated: i.titleTranslated,
            status: i.status,
            symptom: i.symptom,
            symptomTranslated: i.symptomTranslated,
            cause: i.cause,
            causeTranslated: i.causeTranslated,
            solution: i.solution,
            solutionTranslated: i.solutionTranslated,
            contentLanguage: i.contentLanguage,
            rndContact: i.rndContact,
            archivedAt: i.archivedAt ? i.archivedAt.toISOString() : null,
            project: i.project,
            customer: i.customer,
          }))}
          staffAdmin={staffAdmin}
          unarchiveAction={unarchiveIssue}
        />
      </section>
    </div>
  );
}
