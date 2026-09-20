"use server";

import { revalidatePath } from "next/cache";
import type { TemplateKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export async function createTemplate(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role === "CLIENT_STAFF") return "Nur Admins können Vorlagen anlegen.";

  const kind = String(formData.get("kind") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();

  if (kind !== "NOTE" && kind !== "EMAIL") return "Ungültiger Vorlagen-Typ.";
  if (!name || !body) return "Name und Text sind erforderlich.";

  await prisma.messageTemplate.create({
    data: {
      organizationId: session.user.organizationId,
      kind: kind as TemplateKind,
      name,
      subject: kind === "EMAIL" ? subject : null,
      body,
    },
  });

  await logAudit({
    action: "template.created",
    entityType: "MessageTemplate",
    entityId: session.user.organizationId,
    organizationId: session.user.organizationId,
    userId: session.user.id,
    metadata: { kind, name },
  });

  revalidatePath("/dashboard/settings");
}

/**
 * Marks (or unmarks) an EMAIL-Vorlage as die automatische
 * Empfangsbestätigung, die ein Lead/Bewerber selbst bekommt, sobald ein
 * neuer Kontakt dieses Kampagnentyps eingeht (Webhook oder manuell
 * angelegt - nicht bei CSV-Massenimport) - siehe notify-new-contact.ts.
 * Höchstens eine Vorlage pro Organisation und Kampagnentyp: das Setzen
 * einer neuen Standard-Vorlage entfernt die Markierung von einer
 * eventuell vorherigen automatisch.
 */
export async function setTemplateDefaultForKind(formData: FormData) {
  const session = await requireSession();
  if (session.user.role === "CLIENT_STAFF") return;

  const templateId = String(formData.get("templateId") ?? "");
  const kindRaw = String(formData.get("defaultForKind") ?? "");
  const checked = formData.get("checked") === "true";

  if (kindRaw !== "LEADS" && kindRaw !== "APPLICANTS") return;

  const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.organizationId !== session.user.organizationId || template.kind !== "EMAIL") return;

  await prisma.$transaction([
    prisma.messageTemplate.updateMany({
      where: { organizationId: session.user.organizationId, defaultForKind: kindRaw },
      data: { defaultForKind: null },
    }),
    ...(checked
      ? [prisma.messageTemplate.update({ where: { id: templateId }, data: { defaultForKind: kindRaw } })]
      : []),
  ]);

  revalidatePath("/dashboard/settings");
}

export async function deleteTemplate(formData: FormData) {
  const session = await requireSession();
  if (session.user.role === "CLIENT_STAFF") return;

  const templateId = String(formData.get("templateId") ?? "");
  const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.organizationId !== session.user.organizationId) return;

  await prisma.messageTemplate.delete({ where: { id: templateId } });

  revalidatePath("/dashboard/settings");
}
