"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

function parseStringArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export async function createOffer(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Angebote anlegen.";

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const badge = String(formData.get("badge") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Interesse";
  const productTag = String(formData.get("productTag") ?? "").trim().toLowerCase() || null;
  const highlights = parseStringArray(formData.get("highlights"));
  const galleryUrls = parseStringArray(formData.get("galleryUrls"));

  if (!title) return "Titel ist erforderlich.";

  await prisma.offer.create({
    data: {
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      badge: badge || null,
      ctaLabel,
      productTag,
      highlights,
      galleryUrls,
    },
  });

  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard/hub");
}

export async function updateOffer(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Angebote bearbeiten.";

  const offerId = String(formData.get("offerId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const badge = String(formData.get("badge") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Interesse";
  const productTag = String(formData.get("productTag") ?? "").trim().toLowerCase() || null;
  const highlights = parseStringArray(formData.get("highlights"));
  const galleryUrls = parseStringArray(formData.get("galleryUrls"));

  if (!title) return "Titel ist erforderlich.";

  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return "Angebot nicht gefunden.";

  await prisma.offer.update({
    where: { id: offerId },
    data: {
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      badge: badge || null,
      ctaLabel,
      productTag,
      highlights,
      galleryUrls,
    },
  });

  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard/hub");
}

export async function deleteOffer(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Angebote löschen.";

  const offerId = String(formData.get("offerId") ?? "");
  await prisma.offer.deleteMany({ where: { id: offerId } });

  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard/hub");
}

export async function toggleOfferActive(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const offerId = String(formData.get("offerId") ?? "");
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return;

  await prisma.offer.update({ where: { id: offerId }, data: { active: !offer.active } });
  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard/hub");
}

export async function uploadOfferImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { error: "Nur Agentur-Admins können Bilder hochladen." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei ausgewählt." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `Bild ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const url = await storeFile(file, "offers");
  return { url };
}

// Whether the Angebote-Sektion is currently live for clients - controlled by
// the agency admin themselves (see setOffersSectionEnabled), independent of
// deploys.
export async function getOffersSectionEnabled(): Promise<boolean> {
  const settings = await prisma.platformSettings.findUnique({ where: { id: "default" } });
  return settings?.offersSectionEnabled ?? false;
}

export async function setOffersSectionEnabled(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const enabled = formData.get("enabled") === "1";
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", offersSectionEnabled: enabled },
    update: { offersSectionEnabled: enabled },
  });

  await logAudit({
    action: enabled ? "offers_section.enabled" : "offers_section.disabled",
    entityType: "PlatformSettings",
    entityId: "default",
    organizationId: session.user.organizationId,
    userId: session.user.id,
  });

  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard/hub");
}

export async function registerInterest(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const offerId = String(formData.get("offerId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return "Angebot nicht gefunden.";

  await prisma.offerInterest.create({
    data: { offerId, userId: session.user.id, note: note || null },
  });

  await logAudit({
    action: "offer_interest.created",
    entityType: "Offer",
    entityId: offerId,
    organizationId: session.user.organizationId,
    userId: session.user.id,
  });

  revalidatePath("/dashboard/hub");
}
