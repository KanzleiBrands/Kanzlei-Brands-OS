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
 * True for an AGENCY_STAFF user whose department is MARKETING, acting on
 * the agency's own organization (never a client's) - the shared gate behind
 * the internal Marketing-Center (src/app/dashboard/intern/marketing), which
 * reuses the exact same actions/UI as the client-facing Social Media
 * Content and E-Mail-Marketing-Funnel features, with the agency acting as
 * its own "client".
 */
export async function isAgencyMarketingStaffFor(session: Session, organizationId: string): Promise<boolean> {
  if (session.user.role !== "AGENCY_STAFF" || organizationId !== session.user.organizationId) return false;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
  return me?.department === "MARKETING";
}

/** Gate for Social-Media-Beiträge/Kommentare: AGENCY_ADMIN always; Marketing-Mitarbeiter nur für die eigene Organisation. */
export async function assertCanManageSocialContentFor(session: Session, organizationId: string) {
  if (session.user.role === "AGENCY_ADMIN") return;
  if (await isAgencyMarketingStaffFor(session, organizationId)) return;
  throw new AccessDeniedError("Nur Agentur-Admins oder Marketing-Mitarbeiter können Beiträge bearbeiten.");
}

/**
 * AGENCY_ADMIN and CLIENT_ADMIN see every pipeline in their organization.
 * CLIENT_STAFF only sees pipelines explicitly granted via PipelineAccess.
 * Marketing-Mitarbeiter (AGENCY_STAFF) additionally see the agency's own
 * internal-marketing pipelines (organizationId === their own) - see
 * isAgencyMarketingStaffFor. A client's pipeline never has the agency's own
 * organizationId, so this can never leak into client data.
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
  if (await isAgencyMarketingStaffFor(session, pipeline.organizationId)) return;

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
  if (await isAgencyMarketingStaffFor(session, organizationId)) {
    return "ALL";
  }
  const grants = await prisma.pipelineAccess.findMany({
    where: { userId: session.user.id, pipeline: { organizationId } },
    select: { pipelineId: true },
  });
  return grants.map((g) => g.pipelineId);
}
