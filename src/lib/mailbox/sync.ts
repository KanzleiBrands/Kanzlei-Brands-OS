import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/mailbox/send";
import { listGmailMessages } from "@/lib/mailbox/google";
import { listMicrosoftMessages } from "@/lib/mailbox/microsoft";

// Generous overlap window rather than tracking a per-account "last synced"
// cursor - re-seeing an already-stored message is harmless, since inserts
// are deduped on EmailMessage's (emailAccountId, providerMessageId) unique
// constraint via skipDuplicates below.
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Pulls recent messages from every connected mailbox and stores the ones
 * that match an existing Contact's email address (in either direction) as
 * EmailMessage rows, powering the team-wide /dashboard/inbox view - AND as
 * Activity rows (EMAIL_IN/EMAIL_OUT), powering the per-contact "E-Mail"
 * tab's Verlauf (src/app/dashboard/contacts/[contactId]/page.tsx), which
 * reads only from Activity, not EmailMessage. Without the Activity side, a
 * mail sent/received directly in Gmail/Outlook (not via the platform's own
 * "E-Mail senden" form, which already creates both) would show up in
 * Posteingang but never on the contact's own page - meant to be called from
 * a cron route - never throws, so one broken mailbox connection can't take
 * down the rest of the sync.
 */
export async function syncAllMailboxes(): Promise<{ accounts: number; created: number; errors: string[] }> {
  const accounts = await prisma.emailAccount.findMany();
  const since = new Date(Date.now() - LOOKBACK_MS);
  let created = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const accessToken = await getValidAccessToken(account);
      const messages =
        account.provider === "GOOGLE"
          ? await listGmailMessages(accessToken, since)
          : await listMicrosoftMessages(accessToken, since);
      if (messages.length === 0) continue;

      const otherAddresses = [
        ...new Set(messages.map((m) => (m.direction === "OUTBOUND" ? m.toAddress : m.fromAddress))),
      ];
      const contacts = await prisma.contact.findMany({
        where: { email: { in: otherAddresses, mode: "insensitive" } },
        select: { id: true, email: true },
      });
      const contactIdByEmail = new Map(contacts.map((c) => [c.email!.toLowerCase(), c.id]));

      const rows = messages
        .map((m) => {
          const otherAddress = m.direction === "OUTBOUND" ? m.toAddress : m.fromAddress;
          const contactId = contactIdByEmail.get(otherAddress.toLowerCase());
          if (!contactId) return null;
          return {
            direction: m.direction,
            subject: m.subject,
            bodyText: m.bodyText,
            bodyHtml: m.bodyHtml,
            fromAddress: m.fromAddress,
            toAddress: m.toAddress,
            providerMessageId: m.providerMessageId,
            emailAccountId: account.id,
            contactId,
            sentAt: m.sentAt,
          };
        })
        .filter((row) => row !== null);
      if (rows.length === 0) continue;

      // Resolved up front (not via createMany's returned count) so the
      // matching Activity rows below are created only for messages that are
      // genuinely new this run, never re-added for one skipDuplicates
      // already silently kept out.
      const existing = await prisma.emailMessage.findMany({
        where: { emailAccountId: account.id, providerMessageId: { in: rows.map((r) => r.providerMessageId) } },
        select: { providerMessageId: true },
      });
      const existingIds = new Set(existing.map((e) => e.providerMessageId));
      const newRows = rows.filter((r) => !existingIds.has(r.providerMessageId));
      if (newRows.length === 0) continue;

      const result = await prisma.emailMessage.createMany({ data: newRows, skipDuplicates: true });
      created += result.count;

      // Mirrors sendEmailToContact's Activity.create (src/lib/actions/email.ts) -
      // without this, mail sent/received directly in Gmail/Outlook (instead
      // of via the platform's own "E-Mail senden" form) would show up in
      // Posteingang but never in the contact's own "E-Mail"-Tab-Verlauf.
      await prisma.activity.createMany({
        data: newRows.map((r) => ({
          contactId: r.contactId,
          type: r.direction === "OUTBOUND" ? "EMAIL_OUT" : "EMAIL_IN",
          content: r.subject,
          createdAt: r.sentAt,
        })),
      });
    } catch (error) {
      const message = `${account.email}: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[mailbox-sync] failed for account", account.email, error);
      errors.push(message);
    }
  }

  return { accounts: accounts.length, created, errors };
}
