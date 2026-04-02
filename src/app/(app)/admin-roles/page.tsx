import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { AdminRolesClient } from "./admin-roles-client";

export default async function AdminRolesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.role)) redirect("/dashboard");
  return <AdminRolesClient />;
}
