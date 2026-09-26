import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { renderBrandedEmail } from "@/lib/email/template";
import { contactDisplayName } from "@/lib/contact-display";
import { getBaseUrl } from "@/lib/base-url";
import { syncAllMailboxes } from "@/lib/mailbox/sync";
import type { AutomationTrigger } from "@prisma/client";

const THRESHOLD_HOURS: Record<AutomationTrigger, number | null> = {
  NEW_LEAD: null, // fires shortly after creation, not on an "hours unprocessed" threshold
  UNPROCESSED_24H: 24,
  UNPROCESSED_72H: 72,
};

// A NEW_LEAD reminder only makes sense while the lead is actually new - without
// this window, turning the rule on for the first time would immediately email
// about every pre-existing contact in the campaign.
const NEW_LEAD_WINDOW_HOURS = 6;

function hoursSince(date: Date, now: Date) {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

/**
 * Polled by Vercel Cron (see vercel.json). Evaluates every active
 * AutomationRule and emails its recipient once per contact that matches -
 * "once" is enforced via AutomationLog's (ruleId, contactId) unique
 * constraint, since this route re-scans everything on every run.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = await getBaseUrl();

  const rules = await prisma.automationRule.findMany({
    where: { active: true, recipientUserId: { not: null } },
    include: {
      recipientUser: { select: { email: true, name: true } },
      pipeline: { select: { id: true, name: true, kind: true } },
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    if (!rule.recipientUser) continue;

    const contacts = await prisma.contact.findMany({
      where: { pipelineId: rule.pipelineId, stage: { isRejected: false } },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (contacts.length === 0) continue;

    const alreadyLogged = new Set(
      (await prisma.automationLog.findMany({ where: { ruleId: rule.id }, select: { contactId: true } })).map(
        (l) => l.contactId,
      ),
    );

    const noun = rule.pipeline.kind === "APPLICANTS" ? "Bewerber" : "Lead";
    const threshold = THRESHOLD_HOURS[rule.trigger];

    for (const contact of contacts) {
      if (alreadyLogged.has(contact.id)) continue;

      const lastActivityAt = contact.activities[0]?.createdAt ?? contact.createdAt;
      let matches = false;
      if (rule.trigger === "NEW_LEAD") {
        matches = hoursSince(contact.createdAt, now) <= NEW_LEAD_WINDOW_HOURS;
      } else if (threshold !== null) {
        matches = hoursSince(lastActivityAt, now) >= threshold;
      }
      if (!matches) continue;

      const name = contactDisplayName(contact);
      const subject =
        rule.trigger === "NEW_LEAD"
          ? `Neuer ${noun}: ${name} (${rule.pipeline.name})`
          : `${noun} seit ${threshold} Std. unbearbeitet: ${name} (${rule.pipeline.name})`;
      const contactUrl = `${baseUrl}/dashboard/contacts/${contact.id}`;
      const { html, text } = renderBrandedEmail({
        baseUrl,
        preheader: subject,
        heading: `Moin ${rule.recipientUser.name},`,
        paragraphs: [`${name} in der Kampagne "${rule.pipeline.name}" wartet auf Bearbeitung.`],
        ctaLabel: "Kontakt öffnen",
        ctaUrl: contactUrl,
      });

      const result = await sendSystemEmail({ to: rule.recipientUser.email, subject, text, html });
      if (!result.ok) {
        errors.push(`${rule.id}/${contact.id}: ${result.error}`);
        continue;
      }

      await prisma.automationLog.create({ data: { ruleId: rule.id, contactId: contact.id } });
      sent++;
    }
  }

  let mailboxSync: { accounts: number; created: number; errors: string[] } | { failed: string };
  try {
    mailboxSync = await syncAllMailboxes();
    console.log("[cron/automations] mailbox sync result:", mailboxSync);
  } catch (error) {
    console.error("[cron/automations] mailbox sync crashed:", error);
    mailboxSync = { failed: error instanceof Error ? error.message : String(error) };
  }

  return NextResponse.json({ ok: true, sent, errors, mailboxSync });
}
