"use server";

import type { SystemEmailType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { sendSystemEmail } from "@/lib/email/resend";
import { renderBrandedEmail } from "@/lib/email/template";
import { substitutePlaceholders } from "@/lib/email/system-email";
import { SYSTEM_EMAIL_TYPES } from "@/lib/email/system-email-defaults";
import { getBaseUrl } from "@/lib/base-url";

function isSystemEmailType(value: string): value is SystemEmailType {
  return (SYSTEM_EMAIL_TYPES as string[]).includes(value);
}

export async function updateSystemEmailTemplate(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können E-Mail-Vorlagen bearbeiten.";

  const type = String(formData.get("type") ?? "");
  if (!isSystemEmailType(type)) return "Unbekannter E-Mail-Typ.";

  const subject = String(formData.get("subject") ?? "").trim();
  const heading = String(formData.get("heading") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const footerNote = String(formData.get("footerNote") ?? "").trim();

  if (!subject || !heading || !body || !ctaLabel) {
    return "Betreff, Überschrift, Text und Button-Text sind erforderlich.";
  }

  await prisma.systemEmailTemplate.upsert({
    where: { type },
    create: { type, subject, heading, body, ctaLabel, footerNote: footerNote || null },
    update: { subject, heading, body, ctaLabel, footerNote: footerNote || null },
  });

  revalidatePath("/dashboard/settings");
}

const TEST_SAMPLE_VARS = { name: "Lukas", kampagne: "Beispiel-Kampagne" };

export async function sendTestSystemEmail(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Test-Mails versenden.";

  const type = String(formData.get("type") ?? "");
  if (!isSystemEmailType(type)) return "Unbekannter E-Mail-Typ.";

  const subject = String(formData.get("subject") ?? "").trim();
  const heading = String(formData.get("heading") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const footerNote = String(formData.get("footerNote") ?? "").trim();

  if (!subject || !heading || !body || !ctaLabel) {
    return "Betreff, Überschrift, Text und Button-Text sind erforderlich, um eine Test-Mail zu senden.";
  }

  const baseUrl = await getBaseUrl();
  const vars = { ...TEST_SAMPLE_VARS, name: session.user.name };
  const testSubject = `[Test] ${substitutePlaceholders(subject, vars)}`;
  const { html, text } = renderBrandedEmail({
    baseUrl,
    preheader: testSubject,
    heading: substitutePlaceholders(heading, vars),
    paragraphs: [substitutePlaceholders(body, vars)],
    ctaLabel,
    ctaUrl: baseUrl,
    footerNote: footerNote ? substitutePlaceholders(footerNote, vars) : undefined,
  });

  const result = await sendSystemEmail({ to: session.user.email, subject: testSubject, text, html });
  if (!result.ok) return `Test-Mail konnte nicht gesendet werden: ${result.error}`;
  return undefined;
}
