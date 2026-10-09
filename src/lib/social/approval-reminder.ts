import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { renderBrandedEmail } from "@/lib/email/template";
import { getSystemEmailContent, logSystemEmailSent, substitutePlaceholders } from "@/lib/email/system-email";
import { getBaseUrl } from "@/lib/base-url";

const REMINDER_AFTER_DAYS = 3;

/**
 * Erinnert den Kunden per Mail, wenn ein Beitrag seit REMINDER_AFTER_DAYS
 * Tagen unbearbeitet in "Interne Freigabe" (CLIENT_REVIEW) hängt - nur für
 * Kunden, bei denen Organization.socialApprovalReminderEnabled bewusst
 * aktiviert wurde (siehe CLAUDE.md-Automationsregel: default aus). Schickt
 * pro Kunde höchstens eine Mail für den ältesten fälligen Beitrag, nicht pro
 * Beitrag einzeln, um die Kunden nicht zu überfluten. reviewReminderSentAt
 * verhindert, dass derselbe Beitrag mehrfach erinnert - wird bei jeder
 * erneuten CLIENT_REVIEW-Einreichung zurückgesetzt (siehe moveSocialPostStatus
 * in social-posts.ts).
 */
export async function sendDueApprovalReminders(): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const duePosts = await prisma.socialPost.findMany({
    where: {
      status: "CLIENT_REVIEW",
      updatedAt: { lte: cutoff },
      reviewReminderSentAt: null,
      organization: { socialApprovalReminderEnabled: true },
    },
    select: { id: true, organizationId: true },
    orderBy: { updatedAt: "asc" },
  });

  const dueOrgIds = Array.from(new Set(duePosts.map((p) => p.organizationId)));
  if (dueOrgIds.length === 0) return { sent: 0 };

  const baseUrl = await getBaseUrl();
  const content = await getSystemEmailContent("SOCIAL_APPROVAL_REMINDER");
  let sent = 0;

  for (const organizationId of dueOrgIds) {
    const recipients = await prisma.user.findMany({
      where: { organizationId, role: { in: ["CLIENT_ADMIN", "CLIENT_STAFF"] } },
      select: { id: true, email: true, name: true },
    });
    if (recipients.length === 0) continue;

    const ctaUrl = `${baseUrl}/dashboard/social-content`;
    for (const recipient of recipients) {
      const vars = { name: recipient.name };
      const subject = substitutePlaceholders(content.subject, vars);
      const { html, text } = renderBrandedEmail({
        baseUrl,
        preheader: subject,
        heading: substitutePlaceholders(content.heading, vars),
        paragraphs: [substitutePlaceholders(content.body, vars)],
        ctaLabel: content.ctaLabel,
        ctaUrl,
        footerNote: content.footerNote ? substitutePlaceholders(content.footerNote, vars) : undefined,
      });
      const result = await sendSystemEmail({ to: recipient.email, subject, text, html });
      if (result.ok) {
        await logSystemEmailSent({ type: "SOCIAL_APPROVAL_REMINDER", to: recipient.email, subject, organizationId, userId: recipient.id });
      }
    }

    await prisma.socialPost.updateMany({
      where: { organizationId, status: "CLIENT_REVIEW", updatedAt: { lte: cutoff }, reviewReminderSentAt: null },
      data: { reviewReminderSentAt: new Date() },
    });
    sent++;
  }

  return { sent };
}
