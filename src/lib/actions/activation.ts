"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function activateAccount(_prevState: string | undefined, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token || !password || !confirmPassword) {
    return "Alle Felder sind erforderlich.";
  }
  if (password.length < 8) {
    return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  }
  if (password !== confirmPassword) {
    return "Die Passwörter stimmen nicht überein.";
  }

  const user = await prisma.user.findUnique({ where: { activationToken: token } });
  if (!user || !user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
    return "Dieser Link ist ungültig oder abgelaufen. Bitte einen neuen Link anfordern.";
  }

  const wasAlreadyActive = !!user.passwordHash;

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, activationToken: null, activationTokenExpiresAt: null },
  });

  await logAudit({
    action: wasAlreadyActive ? "user.password_reset" : "user.activated",
    entityType: "User",
    entityId: user.id,
    organizationId: user.organizationId,
    userId: user.id,
  });

  redirect(wasAlreadyActive ? "/login?reset=1" : "/login?activated=1");
}
