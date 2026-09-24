import type { PipelineKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { renderBrandedEmail } from "@/lib/email/template";
import { getSystemEmailContent, logSystemEmailSent, substitutePlaceholders } from "@/lib/email/system-email";
import { getBaseUrl } from "@/lib/base-url";

type NewContactPipeline = {
  id: string;
  name: string;
  kind: PipelineKind;
  organizationId: string;
  notifyOnNewContact: boolean;
};

type NewContact = {
  firstName: string | null;
  email: string | null;
};

function substitute(text: string, pipeline: NewContactPipeline, contact: NewContact) {
  return text
    .replaceAll("{{kampagne}}", pipeline.name)
    .replaceAll("{{vorname}}", contact.firstName ?? "");
}

/**
 * Notifies every client user with access to `pipeline` (subject to their own
 * notifyOnNewContact opt-out) that a new lead/applicant came in, and - if the
 * client has set one up - auto-replies to the contact itself with their
 * default "danke für die Bewerbung/Anfrage" template. Called right after a
 * Contact is created (webhook intake, manual add) - never for bulk CSV
 * imports, which are historical data entry rather than a "new" real-time
 * event and would otherwise spam a whole batch of notifications at once.
 */
export async function handleNewContactCreated(pipeline: NewContactPipeline, contact: NewContact) {
  if (pipeline.notifyOnNewContact) {
    const recipients = await prisma.user.findMany({
      where: {
        organizationId: pipeline.organizationId,
        notifyOnNewContact: true,
        OR: [{ role: "CLIENT_ADMIN" }, { role: "CLIENT_STAFF", pipelineAccess: { some: { pipelineId: pipeline.id } } }],
      },
      select: { id: true, email: true, name: true },
    });

    if (recipients.length > 0) {
      const baseUrl = await getBaseUrl();
      const isApplicant = pipeline.kind === "APPLICANTS";
      const type = isApplicant ? "NEW_APPLICANT_NOTIFICATION" : "NEW_LEAD_NOTIFICATION";
      const content = await getSystemEmailContent(type);
      const pipelineUrl = `${baseUrl}/dashboard/pipelines/${pipeline.id}`;

      for (const recipient of recipients) {
        const vars = { name: recipient.name, kampagne: pipeline.name };
        const subject = substitutePlaceholders(content.subject, vars);
        const { html, text } = renderBrandedEmail({
          baseUrl,
          preheader: subject,
          heading: substitutePlaceholders(content.heading, vars),
          paragraphs: [substitutePlaceholders(content.body, vars)],
          ctaLabel: content.ctaLabel,
          ctaUrl: pipelineUrl,
          footerNote: content.footerNote ? substitutePlaceholders(content.footerNote, vars) : undefined,
        });
        const result = await sendSystemEmail({ to: recipient.email, subject, text, html });
        if (result.ok) {
          await logSystemEmailSent({
            type,
            to: recipient.email,
            subject,
            organizationId: pipeline.organizationId,
            userId: recipient.id,
          });
        }
      }
    }
  }

  if (contact.email) {
    const template = await prisma.messageTemplate.findFirst({
      where: { organizationId: pipeline.organizationId, kind: "EMAIL", defaultForKind: pipeline.kind },
    });
    if (template) {
      await sendSystemEmail({
        to: contact.email,
        subject: substitute(template.subject || "Vielen Dank für Ihre Nachricht", pipeline, contact),
        text: substitute(template.body, pipeline, contact),
      });
    }
  }
}
