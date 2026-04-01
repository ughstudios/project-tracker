"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: { name?: string | null; email?: string | null; role?: string | null };
  onLogout: React.ReactNode;
  children: React.ReactNode;
};

function NavItem({ href, label, prefix }: { href: string; label: string; prefix?: boolean }) {
  const pathname = usePathname();
  const active = prefix ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
  return (
    <Link
      href={href}
      className={[
        "block rounded-lg px-3 py-2 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function AppShell({ user, onLogout, children }: Props) {
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-base font-semibold">Project Tracker</div>
              <div className="mt-1 text-xs text-zinc-500">
                {user.name ?? "User"} {user.email ? `(${user.email})` : ""}
              </div>
            </div>
            <nav className="space-y-1">
              <NavItem href="/dashboard" label="Dashboard" />
              <NavItem href="/issues" label="Issues" prefix />
              <NavItem href="/customers" label="Customers" />
              <NavItem href="/projects" label="Projects" />
              <NavItem href="/logs" label="Logs" />
              <NavItem href="/archive" label="Archive" />
              <NavItem href="/account" label="Account" />
              {isAdmin ? <NavItem href="/pending-registrations" label="Pending Registrations" /> : null}
            </nav>
            <div className="mt-6">{onLogout}</div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

