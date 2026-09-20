"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { generateActivationToken } from "@/lib/invite";
import { getBaseUrl } from "@/lib/base-url";

import { slugify } from "@/lib/slugify";

export async function createClientOrganization(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return "Nur Agentur-Admins können neue Kunden anlegen.";
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Name ist erforderlich.";

  const client = await prisma.organization.create({
    data: {
      type: "CLIENT",
      name,
      slug: slugify(name),
      parentId: session.user.organizationId,
    },
  });

  await logAudit({
    action: "organization.created",
    entityType: "Organization",
    entityId: client.id,
    organizationId: session.user.organizationId,
    userId: session.user.id,
    metadata: { name },
  });

  revalidatePath("/dashboard/clients");
}

export async function updateClientName(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return "Nur Agentur-Admins können den Kundennamen ändern.";
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Name ist erforderlich.";

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return "Kunde nicht gefunden.";

  await prisma.organization.update({ where: { id: organizationId }, data: { name } });

  await logAudit({
    action: "organization.renamed",
    entityType: "Organization",
    entityId: organizationId,
    organizationId: session.user.organizationId,
    userId: session.user.id,
    metadata: { from: organization.name, to: name },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${organizationId}`);
}

/** Parses a quota input: empty string means "kein Limit gesetzt" (null), otherwise a non-negative integer. */
function parseQuota(raw: FormDataEntryValue | null): number | null | "invalid" {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return "invalid";
  return parsed;
}

export async function updateOrganizationQuotas(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return "Nur Agentur-Admins können Kontingente ändern.";
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return "Kunde nicht gefunden.";

  const leadsQuota = parseQuota(formData.get("leadsQuota"));
  const applicantsQuota = parseQuota(formData.get("applicantsQuota"));
  if (leadsQuota === "invalid" || applicantsQuota === "invalid") {
    return "Kontingente müssen leer (kein Limit) oder eine positive ganze Zahl sein.";
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { leadsQuota, applicantsQuota },
  });

  await logAudit({
    action: "organization.quotas_updated",
    entityType: "Organization",
    entityId: organizationId,
    organizationId: session.user.organizationId,
    userId: session.user.id,
    metadata: { leadsQuota, applicantsQuota },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${organizationId}`);
}

export async function updateMonthlyReportSetting(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return;

  const monthlyReportEnabled = formData.get("monthlyReportEnabled") === "true";

  await prisma.organization.update({ where: { id: organizationId }, data: { monthlyReportEnabled } });

  await logAudit({
    action: "organization.monthly_report_setting_updated",
    entityType: "Organization",
    entityId: organizationId,
    organizationId: session.user.organizationId,
    userId: session.user.id,
    metadata: { monthlyReportEnabled },
  });

  revalidatePath(`/dashboard/clients/${organizationId}`);
}

/**
 * DSGVO: vollständig löscht (nicht nur anonymisiert) Kontakte in einer
 * Ungeeignet-/Verloren-Stufe, die älter als N Monate sind (siehe
 * /api/cron/daily). Kundenweit statt pro Kampagne, damit ein Kunde mit
 * mehreren Kampagnen desselben Typs die Einstellung nicht mehrfach pflegen
 * muss. Zwei getrennte Fristen, da für Bewerber (AGG/ArbGG-Klagefristen)
 * eine andere rechtliche Grundlage gilt als für Mandatsanfragen
 * (Speicherbegrenzung, Art. 5 Abs. 1 lit. e DSGVO, keine feste Frist).
 * Deliberately opt-in (null = off) - never enabled without an admin
 * explicitly setting a value, since it's a destructive, irreversible
 * deletion of real contact data. Nur für die Agentur änderbar; der Kunde
 * sieht die aktuelle Einstellung nur lesend (siehe /dashboard/settings).
 */
export async function updateDataRetentionSettings(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können diese Einstellung ändern.";

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return "Kunde nicht gefunden.";

  const applicantDataRetentionMonths = parseQuota(formData.get("applicantDataRetentionMonths"));
  const leadDataRetentionMonths = parseQuota(formData.get("leadDataRetentionMonths"));
  if (applicantDataRetentionMonths === "invalid" || leadDataRetentionMonths === "invalid") {
    return "Bitte leer lassen (deaktiviert) oder eine positive ganze Zahl an Monaten angeben.";
  }
  if (
    (applicantDataRetentionMonths !== null && applicantDataRetentionMonths < 1) ||
    (leadDataRetentionMonths !== null && leadDataRetentionMonths < 1)
  ) {
    return "Mindestens 1 Monat.";
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { applicantDataRetentionMonths, leadDataRetentionMonths },
  });

  await logAudit({
    action: "organization.data_retention_updated",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { applicantDataRetentionMonths, leadDataRetentionMonths },
  });

  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/settings");
}

/**
 * Configures how a client can self-serve order more campaigns from their own
 * board: which Jotform to send them to per campaign kind, and who gets
 * notified when they've run out of quota and need to order more.
 */
export async function updateOrganizationIntakeSettings(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return "Nur Agentur-Admins können diese Einstellungen ändern.";
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return "Kunde nicht gefunden.";

  const accountManagerId = String(formData.get("accountManagerId") ?? "").trim() || null;
  const leadsFormUrl = String(formData.get("leadsFormUrl") ?? "").trim() || null;
  const applicantsFormUrl = String(formData.get("applicantsFormUrl") ?? "").trim() || null;

  if (accountManagerId) {
    const manager = await prisma.user.findUnique({ where: { id: accountManagerId } });
    if (!manager || manager.role !== "AGENCY_ADMIN") return "Ungültiger Account Manager.";
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { accountManagerId, leadsFormUrl, applicantsFormUrl },
  });

  revalidatePath(`/dashboard/clients/${organizationId}`);
}

export type CreateUserResult = { status: "error"; message: string } | { status: "success"; link: string } | undefined;

export async function createOrgUser(_prevState: CreateUserResult, formData: FormData): Promise<CreateUserResult> {
  const session = await requireSession();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const requestedRole = String(formData.get("role") ?? "CLIENT_STAFF");

  if (!organizationId || !name || !email) {
    return { status: "error", message: "Alle Felder sind erforderlich." };
  }

  try {
    assertOrganizationAccess(session, organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return { status: "error", message: error.message };
    throw error;
  }

  // CLIENT_ADMIN may only create staff in their own org, never other admins.
  const role = session.user.role === "AGENCY_ADMIN" ? requestedRole : "CLIENT_STAFF";
  if (role === "AGENCY_ADMIN") {
    // Agency staff accounts may only be created directly in the agency's own org.
    if (organizationId !== session.user.organizationId) {
      return { status: "error", message: "Agentur-Mitarbeiter können nur in der eigenen Organisation angelegt werden." };
    }
  } else if (role !== "CLIENT_ADMIN" && role !== "CLIENT_STAFF") {
    return { status: "error", message: "Ungültige Rolle." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { status: "error", message: "Diese E-Mail-Adresse wird bereits verwendet." };
  }

  const { token, expiresAt } = generateActivationToken();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      organizationId,
      passwordHash: null,
      activationToken: token,
      activationTokenExpiresAt: expiresAt,
    },
  });

  await logAudit({
    action: "user.created",
    entityType: "User",
    entityId: user.id,
    organizationId,
    userId: session.user.id,
    metadata: { email, role },
  });

  const baseUrl = await getBaseUrl();
  const link = `${baseUrl}/activate/${token}`;

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/settings");

  return { status: "success", link };
}

export async function regenerateActivationLink(userId: string): Promise<CreateUserResult> {
  const session = await requireSession();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { status: "error", message: "Nutzer nicht gefunden." };

  try {
    assertOrganizationAccess(session, user.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return { status: "error", message: error.message };
    throw error;
  }
  if (session.user.role === "CLIENT_STAFF") {
    return { status: "error", message: "Keine Berechtigung." };
  }

  const { token, expiresAt } = generateActivationToken();
  await prisma.user.update({
    where: { id: userId },
    data: { activationToken: token, activationTokenExpiresAt: expiresAt },
  });

  const baseUrl = await getBaseUrl();
  const link = `${baseUrl}/activate/${token}`;

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/settings");

  return { status: "success", link };
}

export async function deleteUser(formData: FormData) {
  const session = await requireSession();
  const userId = String(formData.get("userId") ?? "");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;
  try {
    assertOrganizationAccess(session, target.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return;
    throw error;
  }
  if (session.user.role === "CLIENT_STAFF") return;
  if (target.id === session.user.id) return;
  // CLIENT_ADMIN may only remove staff in their own org, never other admins.
  if (session.user.role === "CLIENT_ADMIN" && target.role !== "CLIENT_STAFF") return;

  await prisma.user.delete({ where: { id: userId } });

  await logAudit({
    action: "user.deleted",
    entityType: "User",
    entityId: userId,
    organizationId: target.organizationId,
    userId: session.user.id,
    metadata: { name: target.name, email: target.email },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/settings");
}

// Client orgs are never hard-deleted from the UI — only archived (hidden
// from the default Kunden-Übersicht, reversible) — so their data, audit
// trail, and staff logins are never destroyed.
export async function archiveOrganization(formData: FormData) {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");

  if (session.user.role !== "AGENCY_ADMIN") return;

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return;

  await prisma.organization.update({ where: { id: organizationId }, data: { archivedAt: new Date() } });

  await logAudit({
    action: "organization.archived",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { name: organization.name },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${organizationId}`);

  redirect("/dashboard/clients");
}

export async function reactivateOrganization(formData: FormData) {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");

  if (session.user.role !== "AGENCY_ADMIN") return;

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization || organization.type !== "CLIENT") return;

  await prisma.organization.update({ where: { id: organizationId }, data: { archivedAt: null } });

  await logAudit({
    action: "organization.reactivated",
    entityType: "Organization",
    entityId: organizationId,
    organizationId,
    userId: session.user.id,
    metadata: { name: organization.name },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${organizationId}`);
}

export async function createPipeline(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "LEADS");
  const templateId = String(formData.get("templateId") ?? "");

  if (!organizationId || !name || !templateId) return "Alle Felder sind erforderlich.";
  if (kind !== "LEADS" && kind !== "APPLICANTS") return "Ungültiger Kampagnentyp.";

  try {
    assertOrganizationAccess(session, organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }
  if (session.user.role === "CLIENT_STAFF") {
    return "Nur Admins können Kampagnen anlegen.";
  }

  const template = await prisma.stageTemplate.findUnique({ where: { id: templateId } });
  if (!template) return "Statusvorlage nicht gefunden.";
  const templateStages = template.stages as {
    name: string;
    order: number;
    color: string;
    isRejected?: boolean;
    isFinal?: boolean;
  }[];

  const pipeline = await prisma.pipeline.create({
    data: {
      name,
      kind,
      organizationId,
      stages: {
        create: templateStages.map((stage) => ({
          name: stage.name,
          order: stage.order,
          color: stage.color,
          isRejected: Boolean(stage.isRejected),
          isFinal: Boolean(stage.isFinal),
        })),
      },
    },
  });

  await prisma.webhookEndpoint.create({
    data: { source: "GENERIC", organizationId, pipelineId: pipeline.id },
  });

  await logAudit({
    action: "pipeline.created",
    entityType: "Pipeline",
    entityId: pipeline.id,
    organizationId,
    userId: session.user.id,
    metadata: { name, kind },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pipelines");
}

export async function deletePipeline(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return;
  try {
    assertOrganizationAccess(session, pipeline.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return;
    throw error;
  }
  if (session.user.role !== "AGENCY_ADMIN") return;

  await prisma.pipeline.delete({ where: { id: pipelineId } });

  await logAudit({
    action: "pipeline.deleted",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: pipeline.organizationId,
    userId: session.user.id,
    metadata: { name: pipeline.name },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pipelines");

  redirect(`/dashboard/clients/${pipeline.organizationId}`);
}

export async function togglePipelineActive(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return;
  assertOrganizationAccess(session, pipeline.organizationId);
  if (session.user.role !== "AGENCY_ADMIN") return;

  await prisma.pipeline.update({ where: { id: pipelineId }, data: { active: !pipeline.active } });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pipelines");
}

export async function renamePipeline(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Name ist erforderlich.";

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return "Kampagne nicht gefunden.";
  try {
    assertOrganizationAccess(session, pipeline.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }
  if (session.user.role !== "AGENCY_ADMIN") return "Nur die Agentur kann die Kampagne umbenennen.";

  await prisma.pipeline.update({ where: { id: pipelineId }, data: { name } });

  await logAudit({
    action: "pipeline.renamed",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: pipeline.organizationId,
    userId: session.user.id,
    metadata: { from: pipeline.name, to: name },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pipelines");
  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

export async function updatePipelineLocation(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const location = String(formData.get("location") ?? "").trim();

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return "Kampagne nicht gefunden.";
  try {
    assertOrganizationAccess(session, pipeline.organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }
  if (session.user.role !== "AGENCY_ADMIN") return "Nur die Agentur kann den Standort ändern.";

  await prisma.pipeline.update({ where: { id: pipelineId }, data: { location: location || null } });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  revalidatePath(`/dashboard/clients/${pipeline.organizationId}`);
}

export async function toggleDuplicateWarning(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return;
  assertOrganizationAccess(session, pipeline.organizationId);
  if (session.user.role !== "AGENCY_ADMIN") return;

  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { showDuplicateWarning: !pipeline.showDuplicateWarning },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

/**
 * Ob der Kunde per E-Mail benachrichtigt wird, wenn auf dieser Kampagne ein
 * neuer Lead/Bewerber eingeht - wirkt zusammen mit dem persönlichen Schalter
 * jedes einzelnen Nutzers (User.notifyOnNewContact, siehe updateNotificationPreference),
 * siehe src/lib/notify-new-contact.ts.
 */
export async function toggleNotifyOnNewContact(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return;
  assertOrganizationAccess(session, pipeline.organizationId);
  if (session.user.role !== "AGENCY_ADMIN") return;

  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { notifyOnNewContact: !pipeline.notifyOnNewContact },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

export async function setPipelineAccess(formData: FormData) {
  const session = await requireSession();
  const userId = String(formData.get("userId") ?? "");
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const grant = formData.get("grant") === "true";

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AccessDeniedError("User not found");
  assertOrganizationAccess(session, target.organizationId);
  if (session.user.role === "CLIENT_STAFF") {
    throw new AccessDeniedError("Nur Admins können Zugriffe verwalten.");
  }

  if (grant) {
    await prisma.pipelineAccess.upsert({
      where: { userId_pipelineId: { userId, pipelineId } },
      update: {},
      create: { userId, pipelineId },
    });
  } else {
    await prisma.pipelineAccess.deleteMany({ where: { userId, pipelineId } });
  }

  await logAudit({
    action: grant ? "pipeline_access.granted" : "pipeline_access.revoked",
    entityType: "PipelineAccess",
    entityId: pipelineId,
    organizationId: target.organizationId,
    userId: session.user.id,
    metadata: { targetUserId: userId },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/settings");
}
