"use client";

import { isPrivilegedAdmin } from "@/lib/roles";
import { PROJECTS_LIST_VERSION_KEY } from "@/lib/project-list-sync";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const fetchFresh: RequestInit = { credentials: "include", cache: "no-store" };

export type IssueBoardUser = { id: string; name: string; email: string; role: string };
export type IssueBoardProject = {
  id: string;
  name: string;
  product: string;
  customer?: { id: string; name: string };
  _count?: { issues: number };
};
export type IssueBoardCustomer = { id: string; name: string };
export type IssueBoardIssue = {
  id: string;
  createdAt: string;
  title: string;
  titleTranslated: string | null;
  status: string;
  symptom: string;
  symptomTranslated: string | null;
  cause: string;
  causeTranslated: string | null;
  solution: string;
  solutionTranslated: string | null;
  contentLanguage: string | null;
  rndContact: string;
  project: { id: string; name: string; product: string } | null;
  customer: { id: string; name: string } | null;
  assignee: { id: string; name: string; email: string } | null;
  reporter: { id: string; name: string };
};

/** Loads users, issues, projects, and customers when `pathname` is one of `paths`. */
export function useIssueBoardData(paths: readonly string[]) {
  const pathname = usePathname();
  const active = paths.includes(pathname);

  const [users, setUsers] = useState<IssueBoardUser[]>([]);
  const [projects, setProjects] = useState<IssueBoardProject[]>([]);
  const [customers, setCustomers] = useState<IssueBoardCustomer[]>([]);
  const [issues, setIssues] = useState<IssueBoardIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, issuesRes, projectsRes, customersRes] = await Promise.all([
        fetch("/api/users", fetchFresh),
        fetch("/api/issues", fetchFresh),
        fetch("/api/projects", fetchFresh),
        fetch("/api/customers", fetchFresh),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (issuesRes.ok) setIssues(await issuesRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (customersRes.ok) setCustomers(await customersRes.json());

      const sessionRes = await fetch("/api/auth/session", fetchFresh);
      if (sessionRes.ok) {
        const session = (await sessionRes.json()) as { user?: { role?: string } };
        setIsAdmin(isPrivilegedAdmin(session.user?.role));
      } else {
        setIsAdmin(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadData();
  }, [active, loadData]);

  useEffect(() => {
    if (!active) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROJECTS_LIST_VERSION_KEY) void loadData();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [active, loadData]);

  return { users, projects, customers, issues, loading, isAdmin, loadData };
}
