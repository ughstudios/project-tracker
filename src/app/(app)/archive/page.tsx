import { auth } from "@/auth";
import { getServerTranslator } from "@/i18n/server";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function unarchiveCustomer(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return;

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
  if (!session?.user || session.user.role !== "ADMIN") return;

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
  if (!session?.user || session.user.role !== "ADMIN") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const issue = await prisma.issue.update({
    where: { id },
    data: { archivedAt: null },
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
  const isAdmin = session.user.role === "ADMIN";
  const t = await getServerTranslator();

  const [customers, projects, issues] = await Promise.all([
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
        status: true,
        archivedAt: true,
        project: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{t("archive.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("archive.subtitle")}</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("archive.customers")}</h2>
        {customers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">{t("archive.noCustomers")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>
                  {c.name} - {c.archivedAt ? new Date(c.archivedAt).toLocaleString() : ""}
                </span>
                {isAdmin ? (
                  <form action={unarchiveCustomer}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("archive.projects")}</h2>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">{t("archive.noProjects")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>
                  {p.name} ({p.product}) - {p.customer.name} -{" "}
                  {p.archivedAt ? new Date(p.archivedAt).toLocaleString() : ""}
                </span>
                {isAdmin ? (
                  <form action={unarchiveProject}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("archive.issues")}</h2>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">{t("archive.noIssues")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {issues.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span>
                  {i.title} ({i.status}) —{" "}
                  {[i.project?.name, i.customer?.name].filter(Boolean).join(" · ") ||
                    t("issues.unlinked")}
                  {" — "}
                  {i.archivedAt ? new Date(i.archivedAt).toLocaleString() : ""}
                </span>
                {isAdmin ? (
                  <form action={unarchiveIssue}>
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
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
    </div>
  );
}
