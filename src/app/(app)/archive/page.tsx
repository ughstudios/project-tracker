import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ArchivePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

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
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Archive</h1>
        <p className="mt-1 text-sm text-zinc-600">Archived customers, projects, and issues.</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Customers</h2>
        {customers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No archived customers.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {customers.map((c) => (
              <li key={c.id}>
                {c.name} - {c.archivedAt ? new Date(c.archivedAt).toLocaleString() : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Projects</h2>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No archived projects.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {projects.map((p) => (
              <li key={p.id}>
                {p.name} ({p.product}) - {p.customer.name} -{" "}
                {p.archivedAt ? new Date(p.archivedAt).toLocaleString() : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Issues</h2>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No archived issues.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {issues.map((i) => (
              <li key={i.id}>
                {i.title} ({i.status}) - {i.project.name} -{" "}
                {i.archivedAt ? new Date(i.archivedAt).toLocaleString() : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
