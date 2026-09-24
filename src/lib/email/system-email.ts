import type { SystemEmailType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { SYSTEM_EMAIL_DEFAULTS, type SystemEmailContent } from "./system-email-defaults";

export function substitutePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/** The agency's edited content for `type`, falling back to the shipped default until they customize it. */
export async function getSystemEmailContent(type: SystemEmailType): Promise<SystemEmailContent> {
  const row = await prisma.systemEmailTemplate.findUnique({ where: { type } });
  const fallback = SYSTEM_EMAIL_DEFAULTS[type];
  if (!row) return fallback;
  return {
    ...fallback,
    subject: row.subject,
    heading: row.heading,
    body: row.body,
    ctaLabel: row.ctaLabel,
    footerNote: row.footerNote ?? "",
  };
}

/** Records a successfully-sent system email so it shows up in Kunden-Log / Audit-Log as a tracker of what went out. */
export async function logSystemEmailSent(params: {
  type: SystemEmailType;
  to: string;
  subject: string;
  organizationId: string;
  userId?: string;
}) {
  await logAudit({
    action: `system_email.${params.type.toLowerCase()}`,
    entityType: "SystemEmail",
    entityId: params.type,
    organizationId: params.organizationId,
    userId: params.userId,
    metadata: { to: params.to, subject: params.subject },
  });
}
