"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { notifyAccountManager } from "@/lib/actions/account-manager-notify";
import { SOCIAL_CONTENT_PRODUCT_TAG, SOCIAL_CONTENT_PRICE_LABEL } from "@/lib/social-content/constants";

/**
 * Client-facing "Freischalten"-Anfrage für das Social-Media-Content-
 * Management-Paket (Kundenpaywall auf /dashboard/social-content) - mirrors
 * requestEmailMarketingUnlock in src/lib/actions/funnels.ts.
 */
export async function requestSocialContentUnlock(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role === "AGENCY_ADMIN") return "Diese Aktion ist für Kunden gedacht.";
  if (session.user.role === "CLIENT_STAFF") return "Nur Admins können Zusatzmodule anfragen.";

  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    assertOrganizationAccess(session, organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const subject = `${organization?.name ?? "Ein Kunde"} möchte Social Media Content Management freischalten`;
  const text = `${session.user.name} (${session.user.email}) möchte Social Media Content Management freischalten (${SOCIAL_CONTENT_PRICE_LABEL}).`;
  await notifyAccountManager(organizationId, subject, text);

  await logAudit({
    action: "social_content.unlock_requested",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
  });

  return undefined;
}

/** AGENCY_ADMIN-only: marks the add-on as booked/unbooked for this client once the deal is actually closed. */
export async function toggleSocialContentBooked(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new AccessDeniedError("Nur Agentur-Admins können das freischalten.");

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { bookedProductTags: true } });
  if (!organization) return;

  const has = organization.bookedProductTags.includes(SOCIAL_CONTENT_PRODUCT_TAG);
  const bookedProductTags = has
    ? organization.bookedProductTags.filter((t) => t !== SOCIAL_CONTENT_PRODUCT_TAG)
    : [...organization.bookedProductTags, SOCIAL_CONTENT_PRODUCT_TAG];

  await prisma.organization.update({ where: { id: organizationId }, data: { bookedProductTags } });
  await logAudit({
    action: has ? "social_content.unbooked" : "social_content.booked",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
  });

  revalidatePath("/dashboard/social-content");
}
