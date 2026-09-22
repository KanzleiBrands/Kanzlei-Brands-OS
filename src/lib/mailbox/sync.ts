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
 * EmailMessage rows, powering the team-wide /dashboard/inbox view. Meant to
 * be called from a cron route - never throws, so one broken mailbox
 * connection can't take down the rest of the sync.
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

      const result = await prisma.emailMessage.createMany({ data: rows, skipDuplicates: true });
      created += result.count;
    } catch (error) {
      const message = `${account.email}: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[mailbox-sync] failed for account", account.email, error);
      errors.push(message);
    }
  }

  return { accounts: accounts.length, created, errors };
}
