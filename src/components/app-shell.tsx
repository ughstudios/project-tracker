"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/context";
import { LanguageToggle } from "@/components/language-toggle";
import { isPrivilegedAdmin, isSuperAdmin } from "@/lib/roles";

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
        "block rounded-md px-2.5 py-1.5 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function NavGroup({
  title,
  children,
  first,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p
        className={[
          "px-2.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400",
          first ? "pt-0" : "pt-3",
        ].join(" ")}
      >
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function AppShell({ user, onLogout, children }: Props) {
  const { t } = useI18n();
  const staffAdmin = isPrivilegedAdmin(user.role);
  const superAdmin = isSuperAdmin(user.role);
  const showAdminSection = staffAdmin || superAdmin;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="flex flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm lg:min-h-[calc(100vh-3rem)]">
            <div className="mb-3 border-b border-zinc-100 pb-3">
              <div className="text-base font-semibold leading-tight text-zinc-900">
                {t("nav.appTitle")}
              </div>
              <div className="mt-1.5 truncate text-xs leading-snug text-zinc-500" title={user.email ?? undefined}>
                <span className="font-medium text-zinc-700">{user.name ?? t("common.user")}</span>
                {user.email ? <span className="block truncate">{user.email}</span> : null}
              </div>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-1">
              <NavGroup title={t("nav.sectionWork")} first>
                <NavItem href="/dashboard" label={t("nav.dashboard")} />
                <NavItem href="/issues" label={t("nav.issues")} prefix />
                <NavItem href="/projects" label={t("nav.projects")} />
                <NavItem href="/customers" label={t("nav.customers")} />
              </NavGroup>
              <NavGroup title={t("nav.sectionOperations")}>
                <NavItem href="/inventory" label={t("nav.inventory")} />
                <NavItem href="/work-records" label={t("nav.workRecords")} prefix />
              </NavGroup>
              <NavGroup title={t("nav.sectionHistory")}>
                <NavItem href="/logs" label={t("nav.logs")} />
                <NavItem href="/archive" label={t("nav.archive")} />
              </NavGroup>
              <NavGroup title={t("nav.sectionPersonal")}>
                <NavItem href="/account" label={t("nav.account")} />
              </NavGroup>
              {showAdminSection ? (
                <NavGroup title={t("nav.sectionAdmin")}>
                  {staffAdmin ? (
                    <NavItem href="/pending-registrations" label={t("nav.pendingRegistrations")} />
                  ) : null}
                  {superAdmin ? (
                    <NavItem href="/admin-roles" label={t("nav.adminRoles")} />
                  ) : null}
                </NavGroup>
              ) : null}
            </nav>
            <div className="mt-4 border-t border-zinc-200 pt-3">
              <LanguageToggle className="justify-start" />
              <div className="mt-3">{onLogout}</div>
            </div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
