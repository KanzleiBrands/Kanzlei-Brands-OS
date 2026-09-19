"use server";

import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendSystemEmail } from "@/lib/email/resend";
import { sendSlackNotification } from "@/lib/slack";
import { CAMPAIGN_KIND_LABELS } from "@/lib/campaign-kind-labels";

/**
 * A client has used up their booked quota for a campaign kind and wants to
 * order more. Notifies the assigned account manager (falling back to every
 * agency admin if none is assigned) by email and Slack, and always logs an
 * audit entry as a backstop in case both channels are unreachable.
 */
export async function requestAdditionalQuota(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role === "AGENCY_ADMIN") return "Diese Aktion ist für Kunden gedacht.";
  if (session.user.role === "CLIENT_STAFF") return "Nur Admins können weitere Kampagnen beauftragen.";

  const organizationId = String(formData.get("organizationId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "LEADS" && kind !== "APPLICANTS") return "Ungültiger Kampagnentyp.";

  try {
    assertOrganizationAccess(session, organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { accountManager: { select: { email: true, name: true } } },
  });
  if (!organization || organization.type !== "CLIENT") return "Kunde nicht gefunden.";

  const recipients = organization.accountManager
    ? [organization.accountManager]
    : await prisma.user.findMany({
        where: { role: "AGENCY_ADMIN", organizationId: organization.parentId ?? undefined },
        select: { email: true, name: true },
      });

  const kindLabel = CAMPAIGN_KIND_LABELS[kind] ?? kind;
  const subject = `${organization.name} möchte eine weitere ${kindLabel}-Kampagne beauftragen`;
  const text = `${organization.name} hat das gebuchte Kontingent für ${kindLabel} aufgebraucht und möchte eine weitere Kampagne beauftragen.\n\nAngefragt von: ${session.user.name} (${session.user.email})`;

  await Promise.all(recipients.map((recipient) => sendSystemEmail({ to: recipient.email, subject, text })));
  await sendSlackNotification(`📣 ${text}`);

  await logAudit({
    action: "campaign_request.submitted",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { kind, requestedBy: session.user.email },
  });
}
