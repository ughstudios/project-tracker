import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { LogoutButton } from "@/components/logout-button";
import { getNavAccessForSessionUser } from "@/lib/employee-nav";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const navAccess = await getNavAccessForSessionUser(session.user.role);

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
      navAccess={navAccess}
      onLogout={<LogoutButton />}
    >
      {children}
    </AppShell>
  );
}

