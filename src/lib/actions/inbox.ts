"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { sendEmailViaAccount } from "@/lib/mailbox/send";

export async function sendInboxReply(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Keine Berechtigung.";

  const contactId = String(formData.get("contactId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!contactId || !subject || !text) return "Betreff und Nachricht sind erforderlich.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true } });
  if (!contact?.email) return "Dieser Kontakt hat keine E-Mail-Adresse hinterlegt.";

  const account = await prisma.emailAccount.findFirst({ where: { userId: session.user.id } });
  if (!account) {
    return "Du hast noch kein eigenes Postfach verbunden. Das geht unter Einstellungen → Postfach.";
  }

  let providerMessageId: string;
  try {
    providerMessageId = await sendEmailViaAccount(account, { to: contact.email, subject, text });
  } catch (error) {
    console.error("[inbox] sendInboxReply failed:", error);
    return "Senden fehlgeschlagen. Bitte später erneut versuchen.";
  }

  await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND",
      subject,
      bodyText: text,
      bodyHtml: null,
      fromAddress: account.email,
      toAddress: contact.email,
      providerMessageId,
      emailAccountId: account.id,
      contactId,
      sentAt: new Date(),
    },
  });

  revalidatePath("/dashboard/inbox");
  return undefined;
}
