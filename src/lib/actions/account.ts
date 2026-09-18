"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { signOut } from "@/auth";

export type ChangePasswordResult = { status: "error" | "success"; message: string } | undefined;

export async function changePassword(
  _prevState: ChangePasswordResult,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await requireSession();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { status: "error", message: "Alle Felder sind erforderlich." };
  }
  if (newPassword.length < 8) {
    return { status: "error", message: "Das neue Passwort muss mindestens 8 Zeichen lang sein." };
  }
  if (newPassword !== confirmPassword) {
    return { status: "error", message: "Die Passwörter stimmen nicht überein." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) return { status: "error", message: "Nutzer nicht gefunden." };

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return { status: "error", message: "Aktuelles Passwort ist falsch." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await logAudit({
    action: "user.password_changed",
    entityType: "User",
    entityId: user.id,
    organizationId: user.organizationId,
    userId: user.id,
  });

  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Passwort erfolgreich geändert." };
}

export async function changeEmail(
  _prevState: ChangePasswordResult,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await requireSession();

  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();
  const currentPassword = String(formData.get("currentPassword") ?? "");

  if (!newEmail || !currentPassword) {
    return { status: "error", message: "Alle Felder sind erforderlich." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse angeben." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) return { status: "error", message: "Nutzer nicht gefunden." };

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return { status: "error", message: "Passwort ist falsch." };
  }

  if (newEmail === user.email) {
    return { status: "error", message: "Das ist bereits deine aktuelle E-Mail-Adresse." };
  }

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    return { status: "error", message: "Diese E-Mail-Adresse wird bereits verwendet." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });

  await logAudit({
    action: "user.email_changed",
    entityType: "User",
    entityId: user.id,
    organizationId: user.organizationId,
    userId: user.id,
    metadata: { from: user.email, to: newEmail },
  });

  await signOut({ redirectTo: "/login?email_changed=1" });
}
