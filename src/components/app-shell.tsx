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
        "block rounded-md border-l-2 border-transparent py-1.5 pl-2 pr-2 text-xs leading-snug transition-colors",
        active
          ? "border-l-zinc-700 bg-zinc-50/90 font-medium text-zinc-900"
          : "font-normal text-zinc-600 hover:border-l-zinc-200 hover:bg-zinc-50/60 hover:text-zinc-900",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function NavRule() {
  return <div className="my-2 h-px bg-zinc-100" aria-hidden />;
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-1 text-sm font-semibold leading-tight tracking-tight text-zinc-800">{label}</p>
      <div className="ml-0.5 flex flex-col gap-0.5 border-l border-zinc-200/90 pl-2.5">{children}</div>
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
        <div className="grid gap-5 lg:grid-cols-[216px_1fr]">
          <aside className="flex flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm lg:min-h-[calc(100vh-3rem)]">
            <div className="mb-3 border-b border-zinc-100 pb-3">
              <div className="text-[15px] font-semibold leading-tight tracking-tight text-zinc-900">
                {t("nav.appTitle")}
              </div>
              <div
                className="mt-2 truncate text-[11px] leading-snug text-zinc-500"
                title={user.email ? `${user.name ?? ""} ${user.email}`.trim() : undefined}
              >
                <span className="font-medium text-zinc-600">{user.name ?? t("common.user")}</span>
                {user.email ? <span className="mt-0.5 block truncate text-zinc-400">{user.email}</span> : null}
              </div>
            </div>

            <nav className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col">
                <NavSection label={t("nav.sectionOverview")}>
                  <NavItem href="/dashboard" label={t("nav.dashboard")} />
                </NavSection>
                <NavSection label={t("nav.sectionTracking")}>
                  <NavItem href="/issues" label={t("nav.issues")} prefix />
                  <NavItem href="/projects" label={t("nav.projects")} />
                  <NavItem href="/work-records" label={t("nav.workRecords")} prefix />
                </NavSection>
                <NavSection label={t("nav.sectionDirectory")}>
                  <NavItem href="/customers" label={t("nav.customers")} />
                  <NavItem href="/inventory" label={t("nav.inventory")} />
                </NavSection>
                <NavSection label={t("nav.sectionRecords")}>
                  <NavItem href="/logs" label={t("nav.logs")} />
                  <NavItem href="/archive" label={t("nav.archive")} />
                </NavSection>
              </div>

              <NavRule />

              <NavSection label={t("nav.sectionSettings")}>
                <NavItem href="/account" label={t("nav.account")} />
              </NavSection>

              {showAdminSection ? (
                <>
                  <NavRule />
                  <NavSection label={t("nav.footerAdmin")}>
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
