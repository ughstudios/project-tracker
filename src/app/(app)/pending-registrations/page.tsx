import { auth } from "@/auth";
import { getServerTranslator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { approveRegistration, rejectAndDeleteRegistration } from "./actions";

export default async function PendingRegistrationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isPrivilegedAdmin(session.user.role)) redirect("/dashboard");

  const t = await getServerTranslator();

  const pendingUsers = await prisma.user.findMany({
    where: { approvalStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">{t("pending.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("pending.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("pending.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="px-2 py-2 font-medium">{t("common.name")}</th>
                  <th className="px-2 py-2 font-medium">{t("common.email")}</th>
                  <th className="px-2 py-2 font-medium">{t("pending.requested")}</th>
                  <th className="min-w-[12rem] whitespace-nowrap px-2 py-2 font-medium">
                    {t("common.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-100">
                    <td className="px-2 py-2">{user.name}</td>
                    <td className="px-2 py-2">{user.email}</td>
                    <td className="px-2 py-2">{new Date(user.createdAt).toLocaleString()}</td>
                    <td className="min-w-[12rem] whitespace-nowrap px-2 py-2 align-top">
                      <form className="flex flex-col gap-2 sm:inline-flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          formAction={approveRegistration}
                          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                        >
                          {t("pending.approve")}
                        </button>
                        <button
                          type="submit"
                          formAction={rejectAndDeleteRegistration}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                        >
                          {t("pending.rejectDelete")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
