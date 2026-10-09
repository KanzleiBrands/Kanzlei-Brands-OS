"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { encryptToken } from "@/lib/auth-encryption";
import { readWhatsAppPendingConnection, clearWhatsAppPendingConnection } from "@/lib/meta/whatsapp-pending-connection";
import { listWhatsAppPhoneNumbers, type WhatsAppPhoneNumber } from "@/lib/meta/graph";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

export async function listPhoneNumbersForWaba(wabaId: string): Promise<WhatsAppPhoneNumber[]> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const pending = await readWhatsAppPendingConnection();
  if (!pending) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit Facebook verbinden.");
  }
  return listWhatsAppPhoneNumbers(wabaId, pending.userAccessToken);
}

/** Zielorganisation kommt aus dem Pending-Connection-Cookie, nicht aus der Session - siehe whatsapp-pending-connection.ts. */
export async function finalizeWhatsAppConnection(wabaId: string, phoneNumber: WhatsAppPhoneNumber): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const pending = await readWhatsAppPendingConnection();
  if (!pending) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit Facebook verbinden.");
  }

  await prisma.whatsAppChannel.upsert({
    where: { organizationId_phoneNumberId: { organizationId: pending.organizationId, phoneNumberId: phoneNumber.id } },
    create: {
      organizationId: pending.organizationId,
      businessAccountId: wabaId,
      phoneNumberId: phoneNumber.id,
      displayPhoneNumber: phoneNumber.display_phone_number,
      displayName: phoneNumber.verified_name,
      accessTokenEnc: encryptToken(pending.userAccessToken),
      connectedByUserId: session.user.id,
    },
    update: {
      displayPhoneNumber: phoneNumber.display_phone_number,
      displayName: phoneNumber.verified_name,
      accessTokenEnc: encryptToken(pending.userAccessToken),
      active: true,
      lastError: null,
    },
  });

  await clearWhatsAppPendingConnection();
  revalidatePath("/dashboard/intern/marketing/whatsapp");
  if (pending.pipelineId) revalidatePath(`/dashboard/pipelines/${pending.pipelineId}`);
}

/** AGENCY_ADMIN kann jeden Kanal trennen (eigener oder eines Kunden) - gleiches Zugriffsmodell wie bei Social-Media-Kanälen. */
export async function disconnectWhatsAppChannel(channelId: string): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const channel = await prisma.whatsAppChannel.findUnique({ where: { id: channelId } });
  if (!channel) return;

  await prisma.whatsAppChannel.delete({ where: { id: channelId } });
  revalidatePath("/dashboard/intern/marketing/whatsapp");
  revalidatePath("/dashboard/pipelines");
}
