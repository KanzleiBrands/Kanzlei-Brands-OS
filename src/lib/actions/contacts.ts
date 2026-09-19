"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { csvToObjects } from "@/lib/csv";
import { extractContactFields, normalizeFieldKey } from "@/lib/webhook-ingest";
import { storeFile } from "@/lib/file-storage";

export async function deleteContact(formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.contact.delete({ where: { id: contactId } });

  await logAudit({
    action: "contact.deleted",
    entityType: "Contact",
    entityId: contactId,
    organizationId: (await prisma.pipeline.findUnique({ where: { id: contact.pipelineId } }))!.organizationId,
    userId: session.user.id,
  });

  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
}

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

export async function setRating(formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  if (rating < 0 || rating > 5) return;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.contact.update({ where: { id: contactId }, data: { rating: rating || null } });

  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
  revalidatePath(`/dashboard/contacts/${contactId}`);
}

export async function updateContact(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      location: location || null,
    },
  });

  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
  revalidatePath(`/dashboard/contacts/${contactId}`);
}

export async function setCustomField(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!key) return "Feldname ist erforderlich.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  await assertPipelineAccess(session, contact.pipelineId);

  const existing =
    contact.customFields && typeof contact.customFields === "object" && !Array.isArray(contact.customFields)
      ? (contact.customFields as Record<string, unknown>)
      : {};

  await prisma.contact.update({
    where: { id: contactId },
    data: { customFields: { ...existing, [key]: value } as Prisma.InputJsonValue },
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
}

export async function uploadContactCv(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return "Bitte eine Datei auswählen.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  await assertPipelineAccess(session, contact.pipelineId);

  const cvUrl = await storeFile(file, "cvs");
  await prisma.contact.update({ where: { id: contactId }, data: { cvUrl } });

  revalidatePath(`/dashboard/contacts/${contactId}`);
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

export async function importContactsCsv(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return "Bitte eine CSV-Datei auswählen.";
  }

  await assertPipelineAccess(session, pipelineId);

  const firstStage = await prisma.stage.findFirst({
    where: { pipelineId },
    orderBy: { order: "asc" },
  });
  if (!firstStage) return "Diese Pipeline hat keine Stufen.";

  const text = await file.text();
  const rows = csvToObjects(text);
  if (rows.length === 0) return "Die Datei enthält keine verwertbaren Zeilen.";
  if (rows.length > 2000) return "Maximal 2000 Zeilen pro Import.";

  let imported = 0;
  for (const row of rows) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeFieldKey(key)] = value;
    }

    const fields = extractContactFields(normalized);
    if (!fields.firstName && !fields.lastName && !fields.email) continue;

    await prisma.contact.create({
      data: {
        pipelineId,
        stageId: firstStage.id,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        phone: fields.phone,
        location: fields.location,
        cvUrl: fields.cvUrl,
        source: "MANUAL",
        customFields: row,
      },
    });
    imported++;
  }

  await logAudit({
    action: "contacts.csv_imported",
    entityType: "Pipeline",
    entityId: pipelineId,
    organizationId: (await prisma.pipeline.findUnique({ where: { id: pipelineId } }))!.organizationId,
    userId: session.user.id,
    metadata: { imported, rows: rows.length },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  return imported > 0 ? `${imported} Kontakt(e) importiert.` : "Keine gültigen Zeilen gefunden (Name oder E-Mail erforderlich).";
}

export async function addNote(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const type = formData.get("type") === "CALL" ? "CALL" : "NOTE";
  if (!content) return type === "CALL" ? "Notiz zum Anruf darf nicht leer sein." : "Notiz darf nicht leer sein.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.activity.create({
    data: { contactId, userId: session.user.id, type, content },
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
}
