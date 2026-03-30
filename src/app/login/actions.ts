"use server";

import { signIn } from "@/auth";

type LoginState = { error?: string; ok?: boolean };

export async function loginAction(_prevState: LoginState, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
    redirectTo: "/",
  });

  const next = typeof result === "string" ? result : "";
  if (!next || next.includes("error=")) {
    return { error: "Invalid email or password." };
  }

  return { ok: true };
}
