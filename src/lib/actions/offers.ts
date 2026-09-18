"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export async function createOffer(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Angebote anlegen.";

  const organizationId = String(formData.get("organizationId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Interesse";

  if (!organizationId || !title) return "Titel ist erforderlich.";

  await prisma.offer.create({
    data: {
      organizationId,
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      ctaLabel,
    },
  });

  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/hub");
}

export async function toggleOfferActive(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const offerId = String(formData.get("offerId") ?? "");
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return;

  await prisma.offer.update({ where: { id: offerId }, data: { active: !offer.active } });
  revalidatePath(`/dashboard/clients/${offer.organizationId}`);
  revalidatePath("/dashboard/hub");
}

export async function registerInterest(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const offerId = String(formData.get("offerId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return "Angebot nicht gefunden.";

  try {
    assertOrganizationAccess(session, offer.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  await prisma.offerInterest.create({
    data: { offerId, userId: session.user.id, note: note || null },
  });

  await logAudit({
    action: "offer_interest.created",
    entityType: "Offer",
    entityId: offerId,
    organizationId: offer.organizationId,
    userId: session.user.id,
  });

  revalidatePath("/dashboard/hub");
  revalidatePath(`/dashboard/clients/${offer.organizationId}`);
}
