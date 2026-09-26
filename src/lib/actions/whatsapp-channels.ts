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
  if (!pending || pending.organizationId !== session.user.organizationId) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit Facebook verbinden.");
  }
  return listWhatsAppPhoneNumbers(wabaId, pending.userAccessToken);
}

export async function finalizeWhatsAppConnection(wabaId: string, phoneNumber: WhatsAppPhoneNumber): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const pending = await readWhatsAppPendingConnection();
  if (!pending || pending.organizationId !== session.user.organizationId) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit Facebook verbinden.");
  }

  await prisma.whatsAppChannel.upsert({
    where: { organizationId_phoneNumberId: { organizationId: session.user.organizationId, phoneNumberId: phoneNumber.id } },
    create: {
      organizationId: session.user.organizationId,
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
}

export async function disconnectWhatsAppChannel(channelId: string): Promise<void> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const channel = await prisma.whatsAppChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.organizationId !== session.user.organizationId) return;

  await prisma.whatsAppChannel.delete({ where: { id: channelId } });
  revalidatePath("/dashboard/intern/marketing/whatsapp");
}
