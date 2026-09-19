import { Resend } from "resend";

/**
 * System/transactional sender for the Automatisierungen reminder emails,
 * which fire from a cron job with no user session - unlike sendEmailToContact
 * (src/lib/actions/email.ts), this can't go through a staff member's own
 * connected mailbox. Silently no-ops (logging instead) when RESEND_API_KEY
 * isn't configured, so a missing key breaks reminders rather than the cron
 * route itself.
 */
export async function sendSystemEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("[automations] RESEND_API_KEY/RESEND_FROM_EMAIL not configured, skipping email:", { to, subject });
    return { ok: false, error: "E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY fehlt)." };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
