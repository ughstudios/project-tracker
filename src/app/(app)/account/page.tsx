import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AccountSettingsForms } from "@/components/account-settings-forms";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-zinc-600">Update your sign-in email or password.</p>
      </div>
      <AccountSettingsForms currentEmail={session.user.email} />
    </div>
  );
}
