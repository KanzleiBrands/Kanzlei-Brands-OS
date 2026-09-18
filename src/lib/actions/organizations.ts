"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";

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

export async function createOrgUser(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedRole = String(formData.get("role") ?? "CLIENT_STAFF");

  if (!organizationId || !name || !email || !password) {
    return "Alle Felder sind erforderlich.";
  }
  if (password.length < 8) {
    return "Passwort muss mindestens 8 Zeichen lang sein.";
  }

  try {
    assertOrganizationAccess(session, organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  // CLIENT_ADMIN may only create staff in their own org, never other admins.
  const role = session.user.role === "AGENCY_ADMIN" ? requestedRole : "CLIENT_STAFF";
  if (role !== "CLIENT_ADMIN" && role !== "CLIENT_STAFF") {
    return "Ungültige Rolle.";
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return "Diese E-Mail-Adresse wird bereits verwendet.";
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, organizationId },
  });

  await logAudit({
    action: "user.created",
    entityType: "User",
    entityId: user.id,
    organizationId,
    userId: session.user.id,
    metadata: { email, role },
  });

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/team");
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
        create: [
          { name: "Neu", order: 0 },
          { name: "In Bearbeitung", order: 1 },
          { name: "Abgeschlossen", order: 2 },
        ],
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
  revalidatePath("/dashboard/team");
}
