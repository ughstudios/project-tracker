import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const raw = params.message;
  const messageKey = Array.isArray(raw) ? raw[0] : raw;
  const bannerMessage =
    messageKey === "email-changed"
      ? "Your email was updated. Sign in with your new address."
      : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Project Tracker Login</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Sign in to manage and assign project issues.
        </p>
        <LoginForm bannerMessage={bannerMessage} />
      </div>
    </main>
  );
}
