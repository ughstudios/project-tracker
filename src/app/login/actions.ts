"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

type LoginState = { error?: string; ok?: boolean };

export async function loginAction(_prevState: LoginState, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { approvalStatus: true },
  });

  if (user && user.approvalStatus !== "APPROVED") {
    return { error: "Your registration is pending admin approval." };
  }

  const result = await signIn("credentials", {
    email: normalizedEmail,
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
