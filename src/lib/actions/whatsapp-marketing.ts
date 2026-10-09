"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, isAgencyMarketingStaffFor, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { notifyAccountManager } from "@/lib/actions/account-manager-notify";
import { decryptToken } from "@/lib/auth-encryption";
import { sendWhatsAppTemplateMessage } from "@/lib/meta/graph";
import { WHATSAPP_MARKETING_PRODUCT_TAG, WHATSAPP_RECRUITING_PRODUCT_TAG, WHATSAPP_ADDON_PRICE_LABEL } from "@/lib/whatsapp-marketing/constants";

/**
 * WhatsApp Marketing (Mandatsakquise-Kampagnen) und WhatsApp Recruiting
 * (Bewerbungs-Kampagnen) sind zwei separat buchbare Reiter, aber ein
 * gemeinsamer Code-Pfad - der Produkt-Tag/Preis wird serverseitig aus
 * pipeline.kind abgeleitet statt vom Client übergeben, damit niemand sich
 * selbst das falsche Produkt freischalten kann. Mirrors src/lib/actions/funnels.ts
 * (E-Mail Marketing), nur ohne Nurture-Sequenzen - ein WhatsApp-"Beitrag" ist
 * ein einmaliger Vorlagen-Versand an ausgewählte Kontakte dieser Kampagne,
 * weil Meta außerhalb des 24h-Servicefensters ohnehin nur genehmigte
 * Vorlagen statt Freitext erlaubt.
 */
function productTagFor(kind: string): string {
  return kind === "APPLICANTS" ? WHATSAPP_RECRUITING_PRODUCT_TAG : WHATSAPP_MARKETING_PRODUCT_TAG;
}

function labelFor(kind: string): string {
  return kind === "APPLICANTS" ? "WhatsApp Recruiting" : "WhatsApp Marketing";
}

/** Client klickt "Freischalten" auf dem paywalled Reiter - benachrichtigt den Account-Manager, schaltet selbst nichts frei. */
export async function requestWhatsAppUnlock(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role === "AGENCY_ADMIN") return "Diese Aktion ist für Kunden gedacht.";
  if (session.user.role === "CLIENT_STAFF") return "Nur Admins können Zusatzmodule anfragen.";

  const pipelineId = String(formData.get("pipelineId") ?? "");
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { name: true, kind: true, organizationId: true } });
  if (!pipeline) return "Kampagne nicht gefunden.";

  try {
    assertOrganizationAccess(session, pipeline.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const label = labelFor(pipeline.kind);
  const organization = await prisma.organization.findUnique({ where: { id: pipeline.organizationId }, select: { name: true } });
  const subject = `${organization?.name ?? "Ein Kunde"} möchte ${label} freischalten`;
  const text = `${session.user.name} (${session.user.email}) möchte ${label} für die Kampagne "${pipeline.name}" freischalten (${WHATSAPP_ADDON_PRICE_LABEL}).`;
  await notifyAccountManager(pipeline.organizationId, subject, text);

  await logAudit({
    action: "whatsapp_marketing.unlock_requested",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: pipeline.organizationId,
    userId: session.user.id,
    metadata: { kind: pipeline.kind },
  });

  return undefined;
}

/** AGENCY_ADMIN-only: markiert das Zusatzmodul als gebucht/nicht gebucht für diesen Kunden, sobald der Deal steht. */
export async function toggleWhatsAppBooked(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new AccessDeniedError("Nur Agentur-Admins können das freischalten.");

  const organizationId = String(formData.get("organizationId") ?? "");
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { kind: true, organizationId: true } });
  if (!pipeline || pipeline.organizationId !== organizationId) return;

  const tag = productTagFor(pipeline.kind);
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { bookedProductTags: true } });
  if (!organization) return;

  const has = organization.bookedProductTags.includes(tag);
  const bookedProductTags = has
    ? organization.bookedProductTags.filter((t) => t !== tag)
    : [...organization.bookedProductTags, tag];

  await prisma.organization.update({ where: { id: organizationId }, data: { bookedProductTags } });
  await logAudit({
    action: has ? "whatsapp_marketing.unbooked" : "whatsapp_marketing.booked",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { kind: pipeline.kind },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

type SendResult = { status: "success" | "error"; message: string };

/** Verschickt eine genehmigte Vorlage an ausgewählte Kontakte dieser Kampagne - ein einmaliger Versand, keine Sequenz. */
export async function sendWhatsAppCampaignBroadcast(_prevState: SendResult | undefined, formData: FormData): Promise<SendResult> {
  const session = await requireSession();

  const pipelineId = String(formData.get("pipelineId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const templateName = String(formData.get("templateName") ?? "");
  const languageCode = String(formData.get("languageCode") ?? "");
  const contactIds = formData.getAll("contactIds").map(String);

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { organizationId: true, kind: true } });
  if (!pipeline) return { status: "error", message: "Kampagne nicht gefunden." };

  // Gleiches Zugriffsmodell wie bei E-Mail-Marketing: Agentur-Admins immer,
  // Marketing-Mitarbeiter (AGENCY_STAFF) nur für die eigene Organisation
  // (isAgencyMarketingStaffFor prüft das bereits intern).
  if (session.user.role !== "AGENCY_ADMIN" && !(await isAgencyMarketingStaffFor(session, pipeline.organizationId))) {
    return { status: "error", message: "Nur Agentur-Admins oder Marketing-Mitarbeiter können WhatsApp-Nachrichten verschicken." };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: pipeline.organizationId },
    select: { bookedProductTags: true, type: true },
  });
  if (!organization) return { status: "error", message: "Kunde nicht gefunden." };
  const booked = organization.type === "AGENCY" || organization.bookedProductTags.includes(productTagFor(pipeline.kind));
  if (!booked) return { status: "error", message: `${labelFor(pipeline.kind)} ist für diesen Kunden nicht gebucht.` };

  const channel = await prisma.whatsAppChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.organizationId !== pipeline.organizationId) return { status: "error", message: "Kanal nicht gefunden." };

  if (!templateName || !languageCode) return { status: "error", message: "Bitte eine Vorlage wählen." };
  if (contactIds.length === 0) return { status: "error", message: "Bitte mindestens einen Kontakt auswählen." };
  if (contactIds.length > 500) return { status: "error", message: "Maximal 500 Empfänger pro Versand." };

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, pipelineId },
    select: { id: true, phone: true },
  });

  const accessToken = decryptToken(channel.accessTokenEnc);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const contact of contacts) {
    if (!contact.phone) {
      skipped++;
      continue;
    }
    try {
      const result = await sendWhatsAppTemplateMessage({
        phoneNumberId: channel.phoneNumberId,
        accessToken,
        to: contact.phone,
        templateName,
        languageCode,
      });
      await prisma.whatsAppTemplateSend.create({
        data: {
          channelId,
          templateName,
          languageCode,
          recipientPhone: contact.phone,
          status: "SENT",
          externalMessageId: result.id || null,
          sentByUserId: session.user.id,
        },
      });
      sent++;
    } catch (error) {
      await prisma.whatsAppTemplateSend.create({
        data: {
          channelId,
          templateName,
          languageCode,
          recipientPhone: contact.phone,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unbekannter Fehler.",
          sentByUserId: session.user.id,
        },
      });
      failed++;
    }
  }

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  return {
    status: failed > 0 && sent === 0 ? "error" : "success",
    message: `${sent} Nachricht(en) verschickt${failed > 0 ? `, ${failed} fehlgeschlagen` : ""}${skipped > 0 ? `, ${skipped} ohne Telefonnummer übersprungen` : ""}.`,
  };
}
