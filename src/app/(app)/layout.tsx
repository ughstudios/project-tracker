import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
      onLogout={<LogoutButton />}
    >
      {children}
    </AppShell>
  );
}

