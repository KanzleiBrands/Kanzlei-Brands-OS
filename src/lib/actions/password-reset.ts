"use server";

import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { getBaseUrl } from "@/lib/base-url";
import { generateActivationToken } from "@/lib/invite";
import { logAudit } from "@/lib/audit";

export type RequestPasswordResetResult = { status: "error" | "success"; message: string } | undefined;

/**
 * Self-service "Passwort vergessen": checks whether the email is registered
 * at all (as agency staff or a client user) and says so explicitly if not -
 * a deliberate choice for this internal B2B tool with a small, known set of
 * accounts, not a public consumer signup. Reuses the same activation-token
 * mechanism/link (/activate/[token]) as the staff invite flow, since "set a
 * new password given a valid token" is the same operation either way.
 */
export async function requestPasswordReset(
  _prevState: RequestPasswordResetResult,
  formData: FormData,
): Promise<RequestPasswordResetResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { status: "error", message: "Bitte eine E-Mail-Adresse angeben." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      status: "error",
      message: "Diese E-Mail-Adresse ist bei uns nicht als Kunde oder Mitarbeiter hinterlegt.",
    };
  }

  const { token, expiresAt } = generateActivationToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { activationToken: token, activationTokenExpiresAt: expiresAt },
  });

  await logAudit({
    action: "user.password_reset_requested",
    entityType: "User",
    entityId: user.id,
    organizationId: user.organizationId,
    userId: user.id,
  });

  const baseUrl = await getBaseUrl();
  const link = `${baseUrl}/activate/${token}`;
  const result = await sendSystemEmail({
    to: user.email,
    subject: "Passwort zurücksetzen - Kanzlei Brands",
    text: `Hallo ${user.name},\n\ndu hast eine Passwort-Zurücksetzung angefordert. Klicke auf den folgenden Link, um ein neues Passwort festzulegen:\n\n${link}\n\nDer Link ist 7 Tage gültig. Falls du das nicht warst, kannst du diese E-Mail einfach ignorieren - dein Passwort bleibt dann unverändert.`,
  });

  if (!result.ok) {
    return { status: "error", message: `E-Mail konnte nicht gesendet werden: ${result.error}` };
  }

  return {
    status: "success",
    message: "Wir haben dir einen Link zum Zurücksetzen deines Passworts per E-Mail geschickt.",
  };
}
