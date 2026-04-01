"use server";

import bcrypt from "bcryptjs";
import { getServerTranslator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";

type RegisterState = { error?: string; ok?: boolean };

export async function registerAction(_prevState: RegisterState, formData: FormData) {
  const t = await getServerTranslator();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: t("errors.register.requiredFields") };
  }

  if (password.length < 8) {
    return { error: t("errors.register.passwordShort") };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, approvalStatus: true },
  });

  if (existingUser) {
    if (existingUser.approvalStatus === "PENDING") {
      return { error: t("errors.register.pendingEmail") };
    }
    return { error: t("errors.register.exists") };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "EMPLOYEE",
      approvalStatus: "PENDING",
    },
  });

  return { ok: true };
}
