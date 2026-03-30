import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      onLogout={
        <form action={logoutAction}>
          <button className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100">
            Logout
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}

