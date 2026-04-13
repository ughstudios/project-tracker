"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/context";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import type { EmployeeNavTabId } from "@/lib/employee-nav-shared";
import { isPrivilegedAdmin, isSuperAdmin } from "@/lib/roles";

type Props = {
  user: { name?: string | null; email?: string | null; role?: string | null };
  /** Effective visibility of main nav tabs for this user (admins: all true). */
  navAccess: Record<EmployeeNavTabId, boolean>;
  onLogout: React.ReactNode;
  children: React.ReactNode;
};

function NavItem({
  href,
  label,
  prefix,
  title: titleAttr,
}: {
  href: string;
  label: string;
  prefix?: boolean;
  /** Longer description for tooltip / a11y when label is abbreviated */
  title?: string;
}) {
  const pathname = usePathname();
  const active = prefix ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
  return (
    <Link
      href={href}
      title={titleAttr ?? label}
      className={[
        "block rounded-md border-l-2 border-transparent py-1.5 pl-2 pr-1.5 text-sm leading-snug transition-colors",
        active
          ? "border-l-zinc-700 dark:border-l-zinc-300 bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100"
          : "font-normal text-zinc-600 dark:text-zinc-400 hover:border-l-zinc-200 dark:hover:border-l-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function NavRule() {
  return <div className="my-2 h-px bg-zinc-100 dark:bg-zinc-800" aria-hidden />;
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="flex flex-col gap-px pl-0.5">{children}</div>
    </div>
  );
}

export function AppShell({ user, navAccess, onLogout, children }: Props) {
  const { t } = useI18n();
  const staffAdmin = isPrivilegedAdmin(user.role);
  const superAdmin = isSuperAdmin(user.role);
  const showAdminSection = staffAdmin || superAdmin;
  const showTab = (id: EmployeeNavTabId) => navAccess[id] !== false;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[216px_1fr]">
          <aside className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 shadow-sm lg:min-h-[calc(100vh-3rem)]">
            <div className="mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="text-[15px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
                {t("nav.appTitle")}
              </div>
              <div
                className="mt-2 truncate text-[11px] leading-snug text-zinc-500 dark:text-zinc-400"
                title={user.email ? `${user.name ?? ""} ${user.email}`.trim() : undefined}
              >
                <span className="font-medium text-zinc-600 dark:text-zinc-400">{user.name ?? t("common.user")}</span>
                {user.email ? <span className="mt-0.5 block truncate text-zinc-400 dark:text-zinc-500">{user.email}</span> : null}
              </div>
            </div>

            <nav className="flex min-h-0 flex-1 flex-col" aria-label={t("nav.mainMenuAria")}>
              <div className="flex flex-col gap-px">
                {showTab("dashboard") ? (
                  <NavItem href="/dashboard" label={t("nav.dashboard")} />
                ) : null}
                {showTab("kanban") ? <NavItem href="/kanban" label={t("nav.kanban")} /> : null}
                {showTab("issues") ? (
                  <NavItem href="/issues" label={t("nav.issues")} prefix />
                ) : null}
                {showTab("projects") ? (
                  <NavItem href="/projects" label={t("nav.projects")} />
                ) : null}
                {showTab("work-records") ? (
                  <NavItem href="/work-records" label={t("nav.workRecords")} prefix />
                ) : null}
                {showTab("reports") ? (
                  <NavItem href="/reports" label={t("nav.reports")} />
                ) : null}
                {showTab("customers") ? (
                  <NavItem href="/customers" label={t("nav.customers")} />
                ) : null}
                {showTab("inventory") ? (
                  <NavItem href="/inventory" label={t("nav.inventory")} />
                ) : null}
                {showTab("logs") ? <NavItem href="/logs" label={t("nav.logs")} /> : null}
                {showTab("archive") ? (
                  <NavItem href="/archive" label={t("nav.archive")} />
                ) : null}
              </div>

              <NavRule />

              <NavSection label={t("nav.sectionSettings")}>
                <NavItem href="/account" label={t("nav.account")} />
              </NavSection>

              {showAdminSection ? (
                <>
                  <NavRule />
                  <NavSection label={t("nav.footerAdmin")}>
                    <NavItem href="/employee-nav-access" label={t("nav.employeeNavAccess")} />
                    {staffAdmin ? (
                      <NavItem
                        href="/pending-registrations"
                        label={t("nav.pendingShort")}
                        title={t("nav.pendingRegistrations")}
                      />
                    ) : null}
                    {superAdmin ? (
                      <NavItem
                        href="/admin-roles"
                        label={t("nav.adminRolesShort")}
                        title={t("nav.adminRoles")}
                      />
                    ) : null}
                  </NavSection>
                </>
              ) : null}
            </nav>

            <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <ThemeToggle className="justify-start" />
              <div className="mt-3">
                <LanguageToggle className="justify-start" />
              </div>
              <div className="mt-3">{onLogout}</div>
            </div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
