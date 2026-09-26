import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/impersonation";
import type { Session } from "next-auth";

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) {
    throw new AccessDeniedError("Not authenticated");
  }
  return session;
}

/** AGENCY_ADMIN can act on any organization; everyone else only their own. */
export function assertOrganizationAccess(session: Session, organizationId: string) {
  if (session.user.role === "AGENCY_ADMIN") return;
  if (session.user.organizationId !== organizationId) {
    throw new AccessDeniedError("No access to this organization");
  }
}

/**
 * Gate for Social-Media-Beiträge/Kommentare: AGENCY_ADMIN always, for any
 * organization (client or the agency's own). AGENCY_STAFF only for the
 * agency's own organization (never a client's) and only when their
 * department is MARKETING - this is what lets the internal Marketing-Center
 * (src/app/dashboard/intern/marketing) reuse the exact same actions and UI
 * as the client-facing Social Media Content feature, with the agency acting
 * as its own "client".
 */
export async function assertCanManageSocialContentFor(session: Session, organizationId: string) {
  if (session.user.role === "AGENCY_ADMIN") return;
  if (session.user.role === "AGENCY_STAFF" && organizationId === session.user.organizationId) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
    if (me?.department === "MARKETING") return;
  }
  throw new AccessDeniedError("Nur Agentur-Admins oder Marketing-Mitarbeiter können Beiträge bearbeiten.");
}

/**
 * AGENCY_ADMIN and CLIENT_ADMIN see every pipeline in their organization.
 * CLIENT_STAFF only sees pipelines explicitly granted via PipelineAccess.
 */
export async function assertPipelineAccess(session: Session, pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    select: { organizationId: true },
  });
  if (!pipeline) {
    throw new AccessDeniedError("Pipeline not found");
  }

  if (session.user.role === "AGENCY_ADMIN") return;

  if (pipeline.organizationId !== session.user.organizationId) {
    throw new AccessDeniedError("No access to this pipeline");
  }

  if (session.user.role === "CLIENT_ADMIN") return;

  const grant = await prisma.pipelineAccess.findUnique({
    where: { userId_pipelineId: { userId: session.user.id, pipelineId } },
  });
  if (!grant) {
    throw new AccessDeniedError("No access to this pipeline");
  }
}

export async function accessiblePipelineIds(session: Session, organizationId: string): Promise<string[] | "ALL"> {
  if (session.user.role === "AGENCY_ADMIN" || session.user.role === "CLIENT_ADMIN") {
    return "ALL";
  }
  const grants = await prisma.pipelineAccess.findMany({
    where: { userId: session.user.id, pipeline: { organizationId } },
    select: { pipelineId: true },
  });
  return grants.map((g) => g.pipelineId);
}
