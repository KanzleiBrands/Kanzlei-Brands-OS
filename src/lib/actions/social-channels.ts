"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { encryptToken } from "@/lib/auth-encryption";
import { readSocialPendingConnection, clearSocialPendingConnection } from "@/lib/meta/social-pending-connection";
import { getMetaPage, getInstagramBusinessAccount, type MetaPage } from "@/lib/meta/graph";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

/** Re-derives a specific Page's access token from the pending user token cookie, rather than trusting a client-supplied token. */
async function resolvePendingSocialPage(organizationId: string, pageId: string): Promise<MetaPage> {
  const pending = await readSocialPendingConnection();
  if (!pending || pending.organizationId !== organizationId) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit Facebook verbinden.");
  }
  const page = await getMetaPage(pageId, pending.userAccessToken);
  if (!page) throw new Error("Seite nicht gefunden oder keine Berechtigung mehr dafür.");
  return page;
}

export async function checkInstagramForSocialPage(
  organizationId: string,
  pageId: string,
): Promise<{ id: string; username?: string } | null> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const page = await resolvePendingSocialPage(organizationId, pageId);
  return getInstagramBusinessAccount(page.id, page.access_token);
}

export async function finalizeMetaSocialConnection(
  organizationId: string,
  pageId: string,
  options: { connectFacebook: boolean; connectInstagram: boolean },
): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  if (!options.connectFacebook && !options.connectInstagram) {
    throw new Error("Bitte mindestens eine Plattform auswählen.");
  }

  const page = await resolvePendingSocialPage(organizationId, pageId);
  const accessTokenEnc = encryptToken(page.access_token);

  if (options.connectFacebook) {
    await prisma.socialChannel.upsert({
      where: { organizationId_platform_externalId: { organizationId, platform: "FACEBOOK", externalId: page.id } },
      create: {
        organizationId,
        platform: "FACEBOOK",
        externalId: page.id,
        displayName: page.name,
        accessTokenEnc,
        connectedByUserId: session.user.id,
      },
      update: { displayName: page.name, accessTokenEnc, active: true, lastError: null },
    });
  }

  if (options.connectInstagram) {
    const igAccount = await getInstagramBusinessAccount(page.id, page.access_token);
    if (!igAccount) throw new Error("Diese Seite hat kein verknüpftes Instagram-Konto.");
    await prisma.socialChannel.upsert({
      where: {
        organizationId_platform_externalId: { organizationId, platform: "INSTAGRAM", externalId: igAccount.id },
      },
      create: {
        organizationId,
        platform: "INSTAGRAM",
        externalId: igAccount.id,
        displayName: igAccount.username ? `@${igAccount.username}` : page.name,
        // Instagram Content Publishing is authenticated with the linked Page's access token, not a separate IG token.
        accessTokenEnc,
        connectedByUserId: session.user.id,
      },
      update: {
        displayName: igAccount.username ? `@${igAccount.username}` : page.name,
        accessTokenEnc,
        active: true,
        lastError: null,
      },
    });
  }

  await clearSocialPendingConnection();
  revalidatePath(`/dashboard/clients/${organizationId}`);
}

export async function disconnectSocialChannel(channelId: string): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const channel = await prisma.socialChannel.findUnique({ where: { id: channelId } });
  if (!channel) return;

  await prisma.socialChannel.delete({ where: { id: channelId } });
  revalidatePath(`/dashboard/clients/${channel.organizationId}`);
}
