"use server";

import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { sendSlackNotification } from "@/lib/slack";

/**
 * Central "tell the account manager" channel for every upsell-shaped signal
 * (more quota, interest in an Offer, unlocking a paid add-on, ...): emails
 * the assigned account manager (falling back to every agency admin if none
 * is assigned) and always posts the same message to Slack (#upsellanfrage
 * via SLACK_WEBHOOK_URL), so nothing depends on email alone being seen.
 */
export async function notifyAccountManager(organizationId: string, subject: string, text: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { accountManager: { select: { email: true, name: true } } },
  });
  if (!organization) return;

  const recipients = organization.accountManager
    ? [organization.accountManager]
    : await prisma.user.findMany({
        where: { role: "AGENCY_ADMIN", organizationId: organization.parentId ?? undefined },
        select: { email: true, name: true },
      });

  await Promise.all(recipients.map((recipient) => sendSystemEmail({ to: recipient.email, subject, text })));
  await sendSlackNotification(`📣 ${text}`);
}
