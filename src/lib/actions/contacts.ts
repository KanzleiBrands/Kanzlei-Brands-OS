"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export async function moveContactStage(formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;
  await assertPipelineAccess(session, contact.pipelineId);

  const stage = await prisma.stage.findUnique({ where: { id: stageId } });
  if (!stage || stage.pipelineId !== contact.pipelineId) return;

  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { stageId } }),
    prisma.activity.create({
      data: {
        contactId,
        userId: session.user.id,
        type: "STAGE_CHANGE",
        content: `Stage geändert zu "${stage.name}"`,
      },
    }),
  ]);

  await logAudit({
    action: "contact.stage_changed",
    entityType: "Contact",
    entityId: contactId,
    organizationId: (await prisma.pipeline.findUnique({ where: { id: contact.pipelineId } }))!.organizationId,
    userId: session.user.id,
    metadata: { stageId },
  });

  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
}

export async function createContact(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!firstName && !lastName && !email) {
    return "Mindestens Name oder E-Mail ist erforderlich.";
  }

  await assertPipelineAccess(session, pipelineId);

  await prisma.contact.create({
    data: {
      pipelineId,
      stageId,
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      source: "MANUAL",
    },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

export async function addNote(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return "Notiz darf nicht leer sein.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.activity.create({
    data: { contactId, userId: session.user.id, type: "NOTE", content },
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
}
