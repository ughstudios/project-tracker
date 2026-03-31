"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

type RegisterState = { error?: string; ok?: boolean };

export async function registerAction(_prevState: RegisterState, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, approvalStatus: true },
  });

  if (existingUser) {
    if (existingUser.approvalStatus === "PENDING") {
      return { error: "This email already has a pending registration." };
    }
    return { error: "An account with this email already exists." };
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
