"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, isAgencyMarketingStaffFor } from "@/lib/access";
import { decryptToken } from "@/lib/auth-encryption";
import { sendWhatsAppTemplateMessage } from "@/lib/meta/graph";

async function assertCanSend(organizationId: string) {
  const session = await requireSession();
  if (session.user.role === "AGENCY_ADMIN") return session;
  if (await isAgencyMarketingStaffFor(session, organizationId)) return session;
  throw new Error("Nur Agentur-Admins oder Marketing-Mitarbeiter können WhatsApp-Nachrichten verschicken.");
}

function parseRecipients(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(/[\n,]/).map((line) => line.trim()).filter(Boolean))];
}

type SendResult = { status: "success" | "error"; message: string };

export async function sendWhatsAppBroadcast(_prevState: SendResult | undefined, formData: FormData): Promise<SendResult> {
  const channelId = String(formData.get("channelId") ?? "");
  const templateName = String(formData.get("templateName") ?? "");
  const languageCode = String(formData.get("languageCode") ?? "");
  const recipients = parseRecipients(formData.get("recipients"));

  const channel = await prisma.whatsAppChannel.findUnique({ where: { id: channelId } });
  if (!channel) return { status: "error", message: "Kanal nicht gefunden." };

  const session = await assertCanSend(channel.organizationId);

  if (!templateName || !languageCode) return { status: "error", message: "Bitte eine Vorlage wählen." };
  if (recipients.length === 0) return { status: "error", message: "Bitte mindestens eine Telefonnummer angeben." };
  if (recipients.length > 500) return { status: "error", message: "Maximal 500 Empfänger pro Versand." };

  const accessToken = decryptToken(channel.accessTokenEnc);
  let sent = 0;
  let failed = 0;

  for (const recipientPhone of recipients) {
    try {
      const result = await sendWhatsAppTemplateMessage({
        phoneNumberId: channel.phoneNumberId,
        accessToken,
        to: recipientPhone,
        templateName,
        languageCode,
      });
      await prisma.whatsAppTemplateSend.create({
        data: {
          channelId,
          templateName,
          languageCode,
          recipientPhone,
          status: "SENT",
          externalMessageId: result.id || null,
          sentByUserId: session.user.id,
        },
      });
      sent++;
    } catch (error) {
      await prisma.whatsAppTemplateSend.create({
        data: {
          channelId,
          templateName,
          languageCode,
          recipientPhone,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unbekannter Fehler.",
          sentByUserId: session.user.id,
        },
      });
      failed++;
    }
  }

  revalidatePath("/dashboard/intern/marketing/whatsapp");
  return {
    status: failed > 0 && sent === 0 ? "error" : "success",
    message: `${sent} Nachricht(en) verschickt${failed > 0 ? `, ${failed} fehlgeschlagen` : ""}.`,
  };
}
