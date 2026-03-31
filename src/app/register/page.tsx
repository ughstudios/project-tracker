import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Request an Account</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Submit your details and wait for an admin to approve access.
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
