"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";
import { sendEmailViaAccount } from "@/lib/mailbox/send";

export async function sendEmailToContact(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!subject || !text) return "Betreff und Nachricht sind erforderlich.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  if (!contact.email) return "Dieser Kontakt hat keine E-Mail-Adresse.";
  await assertPipelineAccess(session, contact.pipelineId);

  const account = await prisma.emailAccount.findFirst({ where: { userId: session.user.id } });
  if (!account) return "Kein E-Mail-Postfach verbunden. Bitte zuerst unter Postfach verbinden.";

  try {
    const providerMessageId = await sendEmailViaAccount(account, {
      to: contact.email,
      subject,
      text,
    });

    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          direction: "OUTBOUND",
          subject,
          bodyText: text,
          fromAddress: account.email,
          toAddress: contact.email,
          providerMessageId,
          emailAccountId: account.id,
          contactId,
          sentAt: new Date(),
        },
      }),
      prisma.activity.create({
        data: { contactId, userId: session.user.id, type: "EMAIL_OUT", content: subject },
      }),
    ]);
  } catch (error) {
    console.error("sendEmailToContact failed", error);
    return "E-Mail konnte nicht gesendet werden. Bitte Postfach-Verbindung prüfen.";
  }

  revalidatePath(`/dashboard/contacts/${contactId}`);
}

export async function disconnectMailbox(formData: FormData) {
  const session = await requireSession();
  const accountId = String(formData.get("accountId") ?? "");
  await prisma.emailAccount.deleteMany({ where: { id: accountId, userId: session.user.id } });
  revalidatePath("/dashboard/settings");
}
