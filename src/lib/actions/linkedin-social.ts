"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { encryptToken } from "@/lib/auth-encryption";
import {
  readLinkedInPendingConnection,
  clearLinkedInPendingConnection,
} from "@/lib/linkedin/pending-connection";
import { listLinkedInOrganizations } from "@/lib/linkedin/client";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

export async function listLinkedInOrganizationsForConnect(organizationId: string) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const pending = await readLinkedInPendingConnection();
  if (!pending || pending.organizationId !== organizationId) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit LinkedIn verbinden.");
  }
  return listLinkedInOrganizations(pending.userAccessToken);
}

export async function finalizeLinkedInConnection(
  organizationId: string,
  orgUrn: string,
  orgName: string,
): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const pending = await readLinkedInPendingConnection();
  if (!pending || pending.organizationId !== organizationId) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit LinkedIn verbinden.");
  }

  await prisma.socialChannel.upsert({
    where: { organizationId_platform_externalId: { organizationId, platform: "LINKEDIN", externalId: orgUrn } },
    create: {
      organizationId,
      platform: "LINKEDIN",
      externalId: orgUrn,
      displayName: orgName,
      accessTokenEnc: encryptToken(pending.userAccessToken),
      tokenExpiresAt: pending.expiresAt,
      connectedByUserId: session.user.id,
    },
    update: {
      displayName: orgName,
      accessTokenEnc: encryptToken(pending.userAccessToken),
      tokenExpiresAt: pending.expiresAt,
      active: true,
      lastError: null,
    },
  });

  await clearLinkedInPendingConnection();
  revalidatePath(`/dashboard/clients/${organizationId}`);
}
