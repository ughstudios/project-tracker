"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

type LoginState = { error?: string; ok?: boolean };

export async function loginAction(_prevState: LoginState, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  return { ok: true };
}
