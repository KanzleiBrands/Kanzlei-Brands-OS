import type { PipelineKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
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
      select: { email: true, name: true },
    });

    if (recipients.length > 0) {
      const baseUrl = await getBaseUrl();
      const isApplicant = pipeline.kind === "APPLICANTS";
      const subject = `${isApplicant ? "Neue Bewerbung" : "Neuer Lead"} für ${pipeline.name}`;
      const text = [
        `Sie haben ${isApplicant ? "eine neue Bewerbung" : "einen neuen Lead"} für die Kampagne "${pipeline.name}" erhalten.`,
        "",
        `Bitte loggen Sie sich in Ihr Kundenportal ein, um ${isApplicant ? "die Bewerbung" : "die Anfrage"} zu bearbeiten:`,
        `${baseUrl}/dashboard/pipelines/${pipeline.id}`,
      ].join("\n");

      for (const recipient of recipients) {
        await sendSystemEmail({ to: recipient.email, subject, text: `Hallo ${recipient.name},\n\n${text}` });
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
