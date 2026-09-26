"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor, AccessDeniedError } from "@/lib/access";

function revalidateEmailMarketing() {
  revalidatePath("/dashboard/intern/marketing/email");
}

/** Select-Felder in diesem Formular-Set senden bei "nichts ausgewählt" den Sentinel "__none__" statt leer. */
function normalizeSelectValue(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value && value !== "__none__" ? value : null;
}

async function requireAgencyOrgAccess(organizationId: string) {
  const session = await requireSession();
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    throw new AccessDeniedError("Nur Agentur-Admins oder Marketing-Mitarbeiter können das E-Mail-Marketing bearbeiten.");
  }
  return session;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function createMarketingTag(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireAgencyOrgAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Bitte einen Namen angeben.";
  const color = String(formData.get("color") ?? "blue").trim() || "blue";

  const existing = await prisma.marketingTag.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (existing) return "Ein Tag mit diesem Namen existiert schon.";

  await prisma.marketingTag.create({ data: { organizationId, name, color } });
  revalidateEmailMarketing();
  return undefined;
}

export async function deleteMarketingTag(formData: FormData) {
  const tagId = String(formData.get("tagId") ?? "");
  const tag = await prisma.marketingTag.findUnique({ where: { id: tagId } });
  if (!tag) return;
  await requireAgencyOrgAccess(tag.organizationId);
  await prisma.marketingTag.delete({ where: { id: tagId } });
  revalidateEmailMarketing();
}

// ---------------------------------------------------------------------------
// Webhooks (ein Intake-Endpoint pro Tag für ein externes Landingpage-Tool)
// ---------------------------------------------------------------------------

export async function createListWebhook(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const tagId = String(formData.get("tagId") ?? "");
  const tag = await prisma.marketingTag.findUnique({ where: { id: tagId } });
  if (!tag) return "Tag nicht gefunden.";
  try {
    await requireAgencyOrgAccess(tag.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const existing = await prisma.marketingListWebhook.findFirst({ where: { tagId } });
  if (existing) return "Für diesen Tag existiert schon ein Webhook.";

  await prisma.marketingListWebhook.create({ data: { organizationId: tag.organizationId, tagId } });
  revalidateEmailMarketing();
  return undefined;
}

export async function deleteListWebhook(formData: FormData) {
  const webhookId = String(formData.get("webhookId") ?? "");
  const webhook = await prisma.marketingListWebhook.findUnique({ where: { id: webhookId } });
  if (!webhook) return;
  await requireAgencyOrgAccess(webhook.organizationId);
  await prisma.marketingListWebhook.delete({ where: { id: webhookId } });
  revalidateEmailMarketing();
}

// ---------------------------------------------------------------------------
// Subscriber (die E-Mail-Liste)
// ---------------------------------------------------------------------------

/**
 * Hängt einen Tag an einen Subscriber und schreibt ihn dadurch automatisch in
 * jeden aktiven MarketingFunnel ein, dessen triggerTagId dieser Tag ist -
 * kein Double-Opt-in, direkt aktiv. Wird sowohl von der manuellen
 * Tag-Zuweisung im UI als auch vom Webhook-Intake (siehe
 * src/app/api/webhooks/marketing/[token]/route.ts) aufgerufen.
 */
export async function applyTag(subscriberId: string, tagId: string) {
  await prisma.marketingSubscriberTag.upsert({
    where: { subscriberId_tagId: { subscriberId, tagId } },
    create: { subscriberId, tagId },
    update: {},
  });

  const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber || subscriber.status !== "ACTIVE") return;

  const funnels = await prisma.marketingFunnel.findMany({
    where: { triggerTagId: tagId, active: true },
    include: { steps: { orderBy: { order: "asc" }, take: 1 } },
  });

  for (const funnel of funnels) {
    const firstStep = funnel.steps[0];
    if (!firstStep) continue;
    const nextSendAt = new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000);
    await prisma.marketingEnrollment.upsert({
      where: { funnelId_subscriberId: { funnelId: funnel.id, subscriberId } },
      create: { funnelId: funnel.id, subscriberId, nextSendAt },
      update: {},
    });
  }
}

export async function createSubscriber(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireAgencyOrgAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "Bitte eine gültige E-Mail-Adresse angeben.";
  const firstName = String(formData.get("firstName") ?? "").trim() || null;
  const lastName = String(formData.get("lastName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tagId = normalizeSelectValue(formData.get("tagId"));

  const existing = await prisma.marketingSubscriber.findUnique({ where: { organizationId_email: { organizationId, email } } });
  if (existing) return "Dieser Kontakt ist schon in der Liste.";

  const subscriber = await prisma.marketingSubscriber.create({
    data: { organizationId, email, firstName, lastName, phone },
  });
  if (tagId) await applyTag(subscriber.id, tagId);

  revalidateEmailMarketing();
  return undefined;
}

export async function addSubscriberTag(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const subscriberId = String(formData.get("subscriberId") ?? "");
  const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) return "Kontakt nicht gefunden.";
  try {
    await requireAgencyOrgAccess(subscriber.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const tagId = String(formData.get("tagId") ?? "");
  if (!tagId) return "Bitte einen Tag auswählen.";
  await applyTag(subscriberId, tagId);
  revalidateEmailMarketing();
  return undefined;
}

export async function removeSubscriberTag(formData: FormData) {
  const subscriberId = String(formData.get("subscriberId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) return;
  await requireAgencyOrgAccess(subscriber.organizationId);
  await prisma.marketingSubscriberTag.deleteMany({ where: { subscriberId, tagId } });
  revalidateEmailMarketing();
}

/** Manuelles Fallout - z.B. wenn ein Mitarbeiter merkt, dass jemand schon Kunde/Mandant geworden ist. */
export async function suppressSubscriber(formData: FormData) {
  const subscriberId = String(formData.get("subscriberId") ?? "");
  const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) return;
  await requireAgencyOrgAccess(subscriber.organizationId);
  await prisma.$transaction([
    prisma.marketingSubscriber.update({
      where: { id: subscriberId },
      data: { status: "SUPPRESSED", suppressedAt: new Date(), suppressedReason: "manuell" },
    }),
    prisma.marketingEnrollment.updateMany({
      where: { subscriberId, status: "ACTIVE" },
      data: { status: "STOPPED", nextSendAt: null },
    }),
  ]);
  revalidateEmailMarketing();
}

export async function reactivateSubscriber(formData: FormData) {
  const subscriberId = String(formData.get("subscriberId") ?? "");
  const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) return;
  await requireAgencyOrgAccess(subscriber.organizationId);
  await prisma.marketingSubscriber.update({
    where: { id: subscriberId },
    data: { status: "ACTIVE", suppressedAt: null, suppressedReason: null },
  });
  revalidateEmailMarketing();
}

export async function deleteSubscriber(formData: FormData) {
  const subscriberId = String(formData.get("subscriberId") ?? "");
  const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) return;
  await requireAgencyOrgAccess(subscriber.organizationId);
  await prisma.marketingSubscriber.delete({ where: { id: subscriberId } });
  revalidateEmailMarketing();
}

// ---------------------------------------------------------------------------
// Funnels (getrennt von NurtureFunnel/Pipeline - siehe schema.prisma)
// ---------------------------------------------------------------------------

async function requireAgencyMarketingFunnelAccess(funnelId: string) {
  const funnel = await prisma.marketingFunnel.findUnique({ where: { id: funnelId } });
  if (!funnel) throw new AccessDeniedError("Funnel nicht gefunden.");
  await requireAgencyOrgAccess(funnel.organizationId);
  return funnel;
}

export async function createMarketingFunnel(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireAgencyOrgAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const name = String(formData.get("name") ?? "").trim() || "Neuer Funnel";
  const triggerTagId = normalizeSelectValue(formData.get("triggerTagId"));

  await prisma.marketingFunnel.create({ data: { organizationId, name, triggerTagId } });
  revalidateEmailMarketing();
  return undefined;
}

export async function updateMarketingFunnelSettings(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  let funnel;
  try {
    funnel = await requireAgencyMarketingFunnelAccess(funnelId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Bitte einen Namen angeben.";
  const triggerTagId = normalizeSelectValue(formData.get("triggerTagId"));
  const senderAccountId = normalizeSelectValue(formData.get("senderAccountId"));
  const active = formData.get("active") === "true";

  if (active) {
    const stepCount = await prisma.marketingFunnelStep.count({ where: { funnelId } });
    if (stepCount === 0) return "Der Funnel braucht mindestens einen Schritt, bevor er aktiviert werden kann.";
    if (!senderAccountId) return "Bitte ein Absender-Postfach auswählen, bevor der Funnel aktiviert wird.";
  }

  if (senderAccountId) {
    const account = await prisma.emailAccount.findUnique({ where: { id: senderAccountId }, include: { user: true } });
    if (!account || account.user.organizationId !== funnel.organizationId) return "Ungültiges Absender-Postfach.";
  }

  await prisma.marketingFunnel.update({ where: { id: funnelId }, data: { name, triggerTagId, senderAccountId, active } });
  revalidateEmailMarketing();
  return undefined;
}

export async function deleteMarketingFunnel(formData: FormData) {
  const funnelId = String(formData.get("funnelId") ?? "");
  await requireAgencyMarketingFunnelAccess(funnelId);
  await prisma.marketingFunnel.delete({ where: { id: funnelId } });
  revalidateEmailMarketing();
}

export async function addMarketingFunnelStep(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  try {
    await requireAgencyMarketingFunnelAccess(funnelId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  if (!subject || !bodyText) return "Betreff und Text sind erforderlich.";
  const preheader = String(formData.get("preheader") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || null;
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim() || null;
  const delayDays = Math.max(0, Number(formData.get("delayDays") ?? 0) || 0);

  const last = await prisma.marketingFunnelStep.findFirst({ where: { funnelId }, orderBy: { order: "desc" } });
  await prisma.marketingFunnelStep.create({
    data: { funnelId, order: (last?.order ?? 0) + 1, delayDays, subject, preheader, bodyText, ctaLabel, ctaUrl },
  });
  revalidateEmailMarketing();
  return undefined;
}

export async function updateMarketingFunnelStep(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const stepId = String(formData.get("stepId") ?? "");
  const step = await prisma.marketingFunnelStep.findUnique({ where: { id: stepId } });
  if (!step) return "Schritt nicht gefunden.";
  try {
    await requireAgencyMarketingFunnelAccess(step.funnelId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  if (!subject || !bodyText) return "Betreff und Text sind erforderlich.";
  const preheader = String(formData.get("preheader") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || null;
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim() || null;
  const delayDays = Math.max(0, Number(formData.get("delayDays") ?? 0) || 0);

  await prisma.marketingFunnelStep.update({ where: { id: stepId }, data: { subject, preheader, bodyText, ctaLabel, ctaUrl, delayDays } });
  revalidateEmailMarketing();
  return undefined;
}

export async function deleteMarketingFunnelStep(formData: FormData) {
  const stepId = String(formData.get("stepId") ?? "");
  const step = await prisma.marketingFunnelStep.findUnique({ where: { id: stepId } });
  if (!step) return;
  await requireAgencyMarketingFunnelAccess(step.funnelId);
  await prisma.marketingFunnelStep.delete({ where: { id: stepId } });
  revalidateEmailMarketing();
}

export async function reorderMarketingFunnelSteps(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  try {
    await requireAgencyMarketingFunnelAccess(funnelId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  let orderedStepIds: string[];
  try {
    orderedStepIds = JSON.parse(String(formData.get("stepIds") ?? "[]"));
  } catch {
    return "Ungültige Reihenfolge.";
  }
  if (orderedStepIds.length === 0) return undefined;

  await prisma.$transaction([
    ...orderedStepIds.map((id, index) => prisma.marketingFunnelStep.update({ where: { id }, data: { order: -(index + 1) } })),
    ...orderedStepIds.map((id, index) => prisma.marketingFunnelStep.update({ where: { id }, data: { order: index + 1 } })),
  ]);
  revalidateEmailMarketing();
  return undefined;
}

export async function enrollSubscribers(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  try {
    await requireAgencyMarketingFunnelAccess(funnelId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const subscriberIds = formData.getAll("subscriberIds").map(String).filter(Boolean);
  if (subscriberIds.length === 0) return "Bitte mindestens einen Kontakt auswählen.";

  const firstStep = await prisma.marketingFunnelStep.findFirst({ where: { funnelId }, orderBy: { order: "asc" } });
  if (!firstStep) return "Der Funnel braucht mindestens einen Schritt, bevor Kontakte eingeschrieben werden können.";

  const existing = new Set(
    (
      await prisma.marketingEnrollment.findMany({
        where: { funnelId, subscriberId: { in: subscriberIds } },
        select: { subscriberId: true },
      })
    ).map((e) => e.subscriberId),
  );
  const toEnroll = subscriberIds.filter((id) => !existing.has(id));
  if (toEnroll.length === 0) return "Diese Kontakte sind bereits eingeschrieben.";

  const nextSendAt = new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000);
  await prisma.marketingEnrollment.createMany({
    data: toEnroll.map((subscriberId) => ({ funnelId, subscriberId, nextSendAt })),
  });
  revalidateEmailMarketing();
  return undefined;
}

export async function unenrollSubscriber(formData: FormData) {
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const enrollment = await prisma.marketingEnrollment.findUnique({ where: { id: enrollmentId }, include: { funnel: true } });
  if (!enrollment) return;
  await requireAgencyOrgAccess(enrollment.funnel.organizationId);
  await prisma.marketingEnrollment.update({ where: { id: enrollmentId }, data: { status: "STOPPED", nextSendAt: null } });
  revalidateEmailMarketing();
}
