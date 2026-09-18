"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { STAGE_TEMPLATES } from "@/lib/pipeline-stage-templates";
import { generateActivationToken } from "@/lib/invite";
import { getBaseUrl } from "@/lib/base-url";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") + "-" + Math.random().toString(36).slice(2, 6)
  );
}

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
  if (role !== "CLIENT_ADMIN" && role !== "CLIENT_STAFF") {
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

export async function createPipeline(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "LEADS");

  if (!organizationId || !name) return "Alle Felder sind erforderlich.";
  if (kind !== "LEADS" && kind !== "APPLICANTS") return "Ungültiger Pipeline-Typ.";

  try {
    assertOrganizationAccess(session, organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }
  if (session.user.role === "CLIENT_STAFF") {
    return "Nur Admins können Pipelines anlegen.";
  }

  const pipeline = await prisma.pipeline.create({
    data: {
      name,
      kind,
      organizationId,
      stages: {
        create: [...STAGE_TEMPLATES[kind as keyof typeof STAGE_TEMPLATES]],
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
  if (session.user.role === "CLIENT_STAFF") return;

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

  redirect(
    session.user.role === "AGENCY_ADMIN"
      ? `/dashboard/clients/${pipeline.organizationId}`
      : "/dashboard/pipelines",
  );
}

export async function togglePipelineActive(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return;
  assertOrganizationAccess(session, pipeline.organizationId);
  if (session.user.role === "CLIENT_STAFF") return;

  await prisma.pipeline.update({ where: { id: pipelineId }, data: { active: !pipeline.active } });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/pipelines");
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
