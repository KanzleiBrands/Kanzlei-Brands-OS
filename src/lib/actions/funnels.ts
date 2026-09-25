"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { notifyAccountManager } from "@/lib/actions/account-manager-notify";
import { EMAIL_MARKETING_PRODUCT_TAG, EMAIL_MARKETING_PRICE_LABEL } from "@/lib/funnels/constants";
import type { FunnelTriggerType } from "@prisma/client";

const TRIGGER_TYPES: FunnelTriggerType[] = ["MANUAL", "ON_NEW_LEAD", "ON_INACTIVITY"];

async function requireAgencyPipelineAccess(pipelineId: string) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new AccessDeniedError("Nur Agentur-Admins können E-Mail-Funnels bearbeiten.");
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) throw new AccessDeniedError("Kampagne nicht gefunden.");
  if (pipeline.kind !== "LEADS") throw new AccessDeniedError("E-Mail-Marketing ist nur für Mandatsakquise-Kampagnen möglich.");
  assertOrganizationAccess(session, pipeline.organizationId);
  return { session, pipeline };
}

async function requireAgencyFunnelAccess(funnelId: string) {
  const funnel = await prisma.nurtureFunnel.findUnique({ where: { id: funnelId }, include: { pipeline: true } });
  if (!funnel) throw new AccessDeniedError("Funnel nicht gefunden.");
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new AccessDeniedError("Nur Agentur-Admins können E-Mail-Funnels bearbeiten.");
  assertOrganizationAccess(session, funnel.pipeline.organizationId);
  return { session, funnel };
}

export async function createFunnel(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "Neuer Funnel";

  let pipeline;
  try {
    ({ pipeline } = await requireAgencyPipelineAccess(pipelineId));
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  await prisma.nurtureFunnel.create({ data: { pipelineId, name } });
  await logAudit({
    action: "funnel.created",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: pipeline.organizationId,
  });
  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  return undefined;
}

export async function updateFunnelSettings(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  let funnel;
  try {
    ({ funnel } = await requireAgencyFunnelAccess(funnelId));
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Bitte einen Namen angeben.";

  const triggerTypeRaw = String(formData.get("triggerType") ?? "MANUAL");
  if (!TRIGGER_TYPES.includes(triggerTypeRaw as FunnelTriggerType)) return "Ungültiger Trigger.";
  const triggerType = triggerTypeRaw as FunnelTriggerType;

  const inactivityDaysRaw = String(formData.get("inactivityDays") ?? "").trim();
  const inactivityDays = inactivityDaysRaw ? Number(inactivityDaysRaw) : null;
  if (triggerType === "ON_INACTIVITY" && (!inactivityDays || inactivityDays < 1)) {
    return "Bitte eine gültige Anzahl Tage für den Inaktivitäts-Trigger angeben.";
  }

  const senderAccountId = String(formData.get("senderAccountId") ?? "").trim() || null;
  const active = formData.get("active") === "true";

  if (active) {
    const stepCount = await prisma.funnelStep.count({ where: { funnelId } });
    if (stepCount === 0) return "Der Funnel braucht mindestens einen Schritt, bevor er aktiviert werden kann.";
    if (!senderAccountId) return "Bitte ein Absender-Postfach auswählen, bevor der Funnel aktiviert wird.";
  }

  if (senderAccountId) {
    const account = await prisma.emailAccount.findUnique({ where: { id: senderAccountId }, include: { user: true } });
    if (!account || account.user.organizationId !== funnel.pipeline.organizationId) {
      return "Ungültiges Absender-Postfach.";
    }
  }

  await prisma.nurtureFunnel.update({
    where: { id: funnelId },
    data: { name, triggerType, inactivityDays: triggerType === "ON_INACTIVITY" ? inactivityDays : null, senderAccountId, active },
  });
  revalidatePath(`/dashboard/pipelines/${funnel.pipelineId}`);
  return undefined;
}

export async function deleteFunnel(formData: FormData) {
  const funnelId = String(formData.get("funnelId") ?? "");
  const { funnel } = await requireAgencyFunnelAccess(funnelId);
  await prisma.nurtureFunnel.delete({ where: { id: funnelId } });
  revalidatePath(`/dashboard/pipelines/${funnel.pipelineId}`);
}

export async function addFunnelStep(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  let funnel;
  try {
    ({ funnel } = await requireAgencyFunnelAccess(funnelId));
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

  const last = await prisma.funnelStep.findFirst({ where: { funnelId }, orderBy: { order: "desc" } });
  await prisma.funnelStep.create({
    data: { funnelId, order: (last?.order ?? 0) + 1, delayDays, subject, preheader, bodyText, ctaLabel, ctaUrl },
  });
  revalidatePath(`/dashboard/pipelines/${funnel.pipelineId}`);
  return undefined;
}

export async function updateFunnelStep(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const stepId = String(formData.get("stepId") ?? "");
  const step = await prisma.funnelStep.findUnique({ where: { id: stepId }, include: { funnel: { include: { pipeline: true } } } });
  if (!step) return "Schritt nicht gefunden.";
  try {
    await requireAgencyFunnelAccess(step.funnelId);
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

  await prisma.funnelStep.update({ where: { id: stepId }, data: { subject, preheader, bodyText, ctaLabel, ctaUrl, delayDays } });
  revalidatePath(`/dashboard/pipelines/${step.funnel.pipelineId}`);
  return undefined;
}

export async function deleteFunnelStep(formData: FormData) {
  const stepId = String(formData.get("stepId") ?? "");
  const step = await prisma.funnelStep.findUnique({ where: { id: stepId }, include: { funnel: true } });
  if (!step) return;
  await requireAgencyFunnelAccess(step.funnelId);
  await prisma.funnelStep.delete({ where: { id: stepId } });
  revalidatePath(`/dashboard/pipelines/${step.funnel.pipelineId}`);
}

export async function reorderFunnelSteps(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  let funnel;
  try {
    ({ funnel } = await requireAgencyFunnelAccess(funnelId));
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
    ...orderedStepIds.map((id, index) => prisma.funnelStep.update({ where: { id }, data: { order: -(index + 1) } })),
    ...orderedStepIds.map((id, index) => prisma.funnelStep.update({ where: { id }, data: { order: index + 1 } })),
  ]);
  revalidatePath(`/dashboard/pipelines/${funnel.pipelineId}`);
  return undefined;
}

export async function enrollContacts(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const funnelId = String(formData.get("funnelId") ?? "");
  let funnel;
  try {
    ({ funnel } = await requireAgencyFunnelAccess(funnelId));
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const contactIds = formData.getAll("contactIds").map(String).filter(Boolean);
  if (contactIds.length === 0) return "Bitte mindestens einen Lead auswählen.";

  const firstStep = await prisma.funnelStep.findFirst({ where: { funnelId }, orderBy: { order: "asc" } });
  if (!firstStep) return "Der Funnel braucht mindestens einen Schritt, bevor Leads eingeschrieben werden können.";

  const existing = new Set(
    (await prisma.funnelEnrollment.findMany({ where: { funnelId, contactId: { in: contactIds } }, select: { contactId: true } })).map(
      (e) => e.contactId,
    ),
  );
  const toEnroll = contactIds.filter((id) => !existing.has(id));
  if (toEnroll.length === 0) return "Diese Leads sind bereits eingeschrieben.";

  const nextSendAt = new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000);
  await prisma.funnelEnrollment.createMany({
    data: toEnroll.map((contactId) => ({ funnelId, contactId, nextSendAt })),
  });
  revalidatePath(`/dashboard/pipelines/${funnel.pipelineId}`);
  return undefined;
}

export async function unenrollContact(formData: FormData) {
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const enrollment = await prisma.funnelEnrollment.findUnique({ where: { id: enrollmentId }, include: { funnel: true } });
  if (!enrollment) return;
  await requireAgencyFunnelAccess(enrollment.funnelId);
  await prisma.funnelEnrollment.update({ where: { id: enrollmentId }, data: { status: "STOPPED", nextSendAt: null } });
  revalidatePath(`/dashboard/pipelines/${enrollment.funnel.pipelineId}`);
}

/** Client clicks "Freischalten" on the paywalled E-Mail-Marketing tab - notifies the account manager, doesn't grant access itself. */
export async function requestEmailMarketingUnlock(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role === "AGENCY_ADMIN") return "Diese Aktion ist für Kunden gedacht.";
  if (session.user.role === "CLIENT_STAFF") return "Nur Admins können Zusatzmodule anfragen.";

  const pipelineId = String(formData.get("pipelineId") ?? "");
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { name: true, organizationId: true } });
  if (!pipeline) return "Kampagne nicht gefunden.";

  try {
    assertOrganizationAccess(session, pipeline.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const organization = await prisma.organization.findUnique({ where: { id: pipeline.organizationId }, select: { name: true } });
  const subject = `${organization?.name ?? "Ein Kunde"} möchte E-Mail Marketing freischalten`;
  const text = `${session.user.name} (${session.user.email}) möchte E-Mail Marketing für die Kampagne "${pipeline.name}" freischalten (${EMAIL_MARKETING_PRICE_LABEL}).`;
  await notifyAccountManager(pipeline.organizationId, subject, text);

  await logAudit({
    action: "email_marketing.unlock_requested",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: pipeline.organizationId,
    userId: session.user.id,
  });

  return undefined;
}

/** AGENCY_ADMIN-only: marks the add-on as booked/unbooked for this client once the deal is actually closed. */
export async function toggleEmailMarketingBooked(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new AccessDeniedError("Nur Agentur-Admins können das freischalten.");

  const organizationId = String(formData.get("organizationId") ?? "");
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { bookedProductTags: true } });
  if (!organization) return;

  const has = organization.bookedProductTags.includes(EMAIL_MARKETING_PRODUCT_TAG);
  const bookedProductTags = has
    ? organization.bookedProductTags.filter((t) => t !== EMAIL_MARKETING_PRODUCT_TAG)
    : [...organization.bookedProductTags, EMAIL_MARKETING_PRODUCT_TAG];

  await prisma.organization.update({ where: { id: organizationId }, data: { bookedProductTags } });
  await logAudit({
    action: has ? "email_marketing.unbooked" : "email_marketing.booked",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
  });

  if (pipelineId) revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}
