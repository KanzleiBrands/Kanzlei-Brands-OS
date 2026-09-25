"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { notifyAccountManager } from "@/lib/actions/account-manager-notify";

const PATHS = ["/dashboard/partner-program"];

function requireAgency(session: Awaited<ReturnType<typeof requireSession>>) {
  if (session.user.role !== "AGENCY_ADMIN") throw new AccessDeniedError("Nur Agentur-Admins können das Partnerprogramm bearbeiten.");
}

export async function getPartnerPointsBalance(organizationId: string): Promise<number> {
  const result = await prisma.partnerPointsTransaction.aggregate({
    where: { organizationId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

// --- PartnerAction (Punkte sammeln) -----------------------------------

export async function createPartnerAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgency(session);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";
  const description = String(formData.get("description") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Jetzt starten";
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim() || null;
  const points = Math.max(1, Number(formData.get("points") ?? 1) || 1);

  const last = await prisma.partnerAction.findFirst({ orderBy: { order: "desc" } });
  await prisma.partnerAction.create({ data: { title, description, ctaLabel, ctaUrl, points, order: (last?.order ?? 0) + 1 } });

  revalidatePath(PATHS[0]);
  revalidatePath("/dashboard/clients");
  return undefined;
}

export async function updatePartnerAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgency(session);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const actionId = String(formData.get("actionId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";
  const description = String(formData.get("description") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Jetzt starten";
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim() || null;
  const points = Math.max(1, Number(formData.get("points") ?? 1) || 1);

  const action = await prisma.partnerAction.findUnique({ where: { id: actionId } });
  if (!action) return "Aktion nicht gefunden.";

  await prisma.partnerAction.update({ where: { id: actionId }, data: { title, description, ctaLabel, ctaUrl, points } });
  revalidatePath(PATHS[0]);
  return undefined;
}

export async function deletePartnerAction(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);
  const actionId = String(formData.get("actionId") ?? "");
  await prisma.partnerAction.deleteMany({ where: { id: actionId } });
  revalidatePath(PATHS[0]);
}

export async function togglePartnerActionActive(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);
  const actionId = String(formData.get("actionId") ?? "");
  const action = await prisma.partnerAction.findUnique({ where: { id: actionId } });
  if (!action) return;
  await prisma.partnerAction.update({ where: { id: actionId }, data: { active: !action.active } });
  revalidatePath(PATHS[0]);
}

export async function movePartnerAction(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);
  const actionId = String(formData.get("actionId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const actions = await prisma.partnerAction.findMany({ orderBy: { order: "asc" } });
  const index = actions.findIndex((a) => a.id === actionId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= actions.length) return;

  await prisma.$transaction([
    prisma.partnerAction.update({ where: { id: actions[index].id }, data: { order: actions[target].order } }),
    prisma.partnerAction.update({ where: { id: actions[target].id }, data: { order: actions[index].order } }),
  ]);
  revalidatePath(PATHS[0]);
}

// --- PartnerReward (Punkte einlösen) ------------------------------------

export async function uploadPartnerRewardImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { error: "Nur Agentur-Admins können Bilder hochladen." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei ausgewählt." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `Bild ist zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const url = await storeFile(file, "partner-rewards");
  return { url };
}

export async function createPartnerReward(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgency(session);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";
  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Prämien-Punkte einlösen";
  const pointsCost = Math.max(1, Number(formData.get("pointsCost") ?? 1) || 1);

  const last = await prisma.partnerReward.findFirst({ orderBy: { order: "desc" } });
  await prisma.partnerReward.create({
    data: { title, description, imageUrl, ctaLabel, pointsCost, order: (last?.order ?? 0) + 1 },
  });

  revalidatePath(PATHS[0]);
  return undefined;
}

export async function updatePartnerReward(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgency(session);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const rewardId = String(formData.get("rewardId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Titel ist erforderlich.";
  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Prämien-Punkte einlösen";
  const pointsCost = Math.max(1, Number(formData.get("pointsCost") ?? 1) || 1);

  const reward = await prisma.partnerReward.findUnique({ where: { id: rewardId } });
  if (!reward) return "Prämie nicht gefunden.";

  await prisma.partnerReward.update({ where: { id: rewardId }, data: { title, description, imageUrl, ctaLabel, pointsCost } });
  revalidatePath(PATHS[0]);
  return undefined;
}

export async function deletePartnerReward(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);
  const rewardId = String(formData.get("rewardId") ?? "");
  await prisma.partnerReward.deleteMany({ where: { id: rewardId } });
  revalidatePath(PATHS[0]);
}

export async function togglePartnerRewardActive(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);
  const rewardId = String(formData.get("rewardId") ?? "");
  const reward = await prisma.partnerReward.findUnique({ where: { id: rewardId } });
  if (!reward) return;
  await prisma.partnerReward.update({ where: { id: rewardId }, data: { active: !reward.active } });
  revalidatePath(PATHS[0]);
}

export async function movePartnerReward(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);
  const rewardId = String(formData.get("rewardId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const rewards = await prisma.partnerReward.findMany({ orderBy: { order: "asc" } });
  const index = rewards.findIndex((r) => r.id === rewardId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= rewards.length) return;

  await prisma.$transaction([
    prisma.partnerReward.update({ where: { id: rewards[index].id }, data: { order: rewards[target].order } }),
    prisma.partnerReward.update({ where: { id: rewards[target].id }, data: { order: rewards[index].order } }),
  ]);
  revalidatePath(PATHS[0]);
}

// --- Punkte-Ledger -------------------------------------------------------

/** Agentur schreibt einem Kunden Punkte für eine erledigte PartnerAction gut. */
export async function creditPartnerAction(formData: FormData) {
  const session = await requireSession();
  requireAgency(session);

  const organizationId = String(formData.get("organizationId") ?? "");
  const actionId = String(formData.get("actionId") ?? "");
  const action = await prisma.partnerAction.findUnique({ where: { id: actionId } });
  if (!action) return;

  await prisma.partnerPointsTransaction.create({
    data: {
      kind: "EARNED",
      points: action.points,
      organizationId,
      actionId,
      userId: session.user.id,
      note: `Gutgeschrieben für "${action.title}"`,
    },
  });

  await logAudit({
    action: "partner_points.earned",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { actionId, points: action.points },
  });

  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath(PATHS[0]);
}

/** Agentur korrigiert den Punktestand manuell (positiv oder negativ). */
export async function adjustPartnerPoints(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  try {
    requireAgency(session);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const points = Number(formData.get("points") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!points) return "Bitte eine Punktzahl ungleich 0 angeben.";

  await prisma.partnerPointsTransaction.create({
    data: { kind: "ADJUSTMENT", points, organizationId, userId: session.user.id, note },
  });

  await logAudit({
    action: "partner_points.adjusted",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { points, note },
  });

  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath(PATHS[0]);
  return undefined;
}

/** Kunde löst eine Prämie gegen sein Punkteguthaben ein. */
export async function redeemPartnerReward(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role === "AGENCY_ADMIN") return "Diese Aktion ist für Kunden gedacht.";

  const rewardId = String(formData.get("rewardId") ?? "");
  const reward = await prisma.partnerReward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.active) return "Prämie nicht gefunden.";

  const organizationId = session.user.organizationId;
  const balance = await getPartnerPointsBalance(organizationId);
  if (balance < reward.pointsCost) return "Nicht genug Prämien-Punkte.";

  await prisma.partnerPointsTransaction.create({
    data: {
      kind: "REDEEMED",
      points: -reward.pointsCost,
      organizationId,
      rewardId,
      userId: session.user.id,
      note: `Eingelöst: "${reward.title}"`,
    },
  });

  await logAudit({
    action: "partner_points.redeemed",
    entityType: "PartnerReward",
    entityId: rewardId,
    organizationId,
    userId: session.user.id,
    metadata: { pointsCost: reward.pointsCost },
  });

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const subject = `${organization?.name ?? "Ein Kunde"} hat "${reward.title}" eingelöst`;
  const text = `${session.user.name} (${session.user.email}) hat ${reward.pointsCost} Prämien-Punkte gegen "${reward.title}" eingelöst. Bitte die Umsetzung einplanen.`;
  await notifyAccountManager(organizationId, subject, text);

  revalidatePath(PATHS[0]);
  return undefined;
}
