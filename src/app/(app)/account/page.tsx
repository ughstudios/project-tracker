import { AccountSettingsForms } from "@/components/account-settings-forms";
import { getServerTranslator } from "@/i18n/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const t = await getServerTranslator();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("account.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("account.subtitle")}</p>
      </div>
      <AccountSettingsForms currentEmail={session.user.email} />
    </div>
  );
}
