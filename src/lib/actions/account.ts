"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { logAudit } from "@/lib/audit";

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

  revalidatePath("/dashboard/account");
  return { status: "success", message: "Passwort erfolgreich geändert." };
}
