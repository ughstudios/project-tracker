"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getServerTranslator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";

type PasswordState = { error?: string; ok?: boolean };
type EmailState = { error?: string; ok?: boolean };
type NameState = { error?: string; ok?: boolean };

const NAME_MAX_LEN = 200;

export async function updateNameAction(_prevState: NameState, formData: FormData): Promise<NameState> {
  const t = await getServerTranslator();
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("errors.account.mustSignIn") };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: t("errors.account.nameRequired") };
  }
  if (name.length > NAME_MAX_LEN) {
    return { error: t("errors.account.nameTooLong") };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!user) {
    return { error: t("errors.account.accountNotFound") };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  return { ok: true };
}

export async function updatePasswordAction(
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const t = await getServerTranslator();
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("errors.account.mustSignIn") };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: t("errors.account.passwordsRequired") };
  }

  if (newPassword.length < 8) {
    return { error: t("errors.account.newPasswordShort") };
  }

  if (newPassword !== confirmPassword) {
    return { error: t("errors.account.passwordsMismatch") };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) {
    return { error: t("errors.account.accountNotFound") };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: t("errors.account.wrongPassword") };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { ok: true };
}

export async function updateEmailAction(
  _prevState: EmailState,
  formData: FormData,
): Promise<EmailState> {
  const t = await getServerTranslator();
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("errors.account.mustSignIn") };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();

  if (!currentPassword || !newEmail) {
    return { error: t("errors.account.emailPasswordRequired") };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    return { error: t("errors.account.invalidEmail") };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });

  if (!user) {
    return { error: t("errors.account.accountNotFound") };
  }

  if (newEmail === user.email) {
    return { error: t("errors.account.sameEmail") };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: t("errors.account.wrongPassword") };
  }

  const taken = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });

  if (taken) {
    return { error: t("errors.account.emailTaken") };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email: newEmail },
  });

  return { ok: true };
}
