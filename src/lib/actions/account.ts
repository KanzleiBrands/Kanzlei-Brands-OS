"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { signOut } from "@/auth";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { storeFile } from "@/lib/file-storage";

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

  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
  await signOut({ redirectTo: "/login?email_changed=1" });
}

/**
 * Persönlicher Schalter (nicht pro Kampagne): per E-Mail benachrichtigt
 * werden, wenn auf einer Kampagne mit Zugriff ein neuer Lead/Bewerber
 * eingeht. Greift nur zusammen mit dem kampagnenweiten
 * Pipeline.notifyOnNewContact (siehe toggleNotifyOnNewContact) - siehe
 * src/lib/notify-new-contact.ts.
 */
export async function updateNotificationPreference(formData: FormData) {
  const session = await requireSession();
  const notifyOnNewContact = formData.get("notifyOnNewContact") === "true";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifyOnNewContact },
  });

  revalidatePath("/dashboard/settings");
}

/**
 * Telefonnummer + Calendly-Terminlink, die ein Agentur-Mitarbeiter selbst
 * pflegt, sobald er als Account Manager (siehe Organization.accountManagerId,
 * pro Kunde) oder als der eine portalweite Buchhaltungs-/Backoffice-
 * Ansprechpartner (siehe Organization.backofficeContactId auf der
 * Agentur-Organisation) im Kunden-Hub angezeigt wird.
 */
export async function updateContactInfo(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const calendlyUrl = String(formData.get("calendlyUrl") ?? "").trim() || null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone, calendlyUrl },
  });

  revalidatePath("/dashboard/settings");
  return undefined;
}

/**
 * Profilbild, das ein Agentur-Mitarbeiter selbst pflegt und das im
 * Kunden-Hub in den Account Manager-/Backoffice-Kontaktkacheln angezeigt
 * wird, sobald er dort als Ansprechpartner hinterlegt ist.
 */
export async function updateAvatar(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return "Bitte ein Bild auswählen.";
  if (!file.type.startsWith("image/")) return "Bitte eine Bilddatei auswählen.";

  const avatarUrl = await storeFile(file, "avatars");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/hub");
  return undefined;
}
