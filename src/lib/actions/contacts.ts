"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { csvToObjects } from "@/lib/csv";
import { extractContactFields, normalizeFieldKey, stripTrackingFields } from "@/lib/webhook-ingest";
import { storeFile } from "@/lib/file-storage";
import { deriveWebsiteFromEmail } from "@/lib/company";

const TALENTPOOL_FOLLOWUP_DAYS = 182; // ~6 Monate

export async function setTalentPool(formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const enabled = formData.get("enabled") === "true";
  const note = String(formData.get("note") ?? "").trim() || null;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.contact.update({
    where: { id: contactId },
    data: { talentPool: enabled, talentPoolNote: enabled ? note : null },
  });

  if (enabled) {
    await prisma.task.create({
      data: {
        contactId,
        title: "Talentpool: erneut kontaktieren",
        dueAt: new Date(Date.now() + TALENTPOOL_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000),
        createdByUserId: session.user.id,
        assignedToUserId: session.user.id,
      },
    });
  }

  await logAudit({
    action: enabled ? "contact.talentpool_added" : "contact.talentpool_removed",
    entityType: "Contact",
    entityId: contactId,
    organizationId: (await prisma.pipeline.findUnique({ where: { id: contact.pipelineId } }))!.organizationId,
    userId: session.user.id,
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
  revalidatePath("/dashboard/tasks");
}

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
  revalidatePath("/dashboard/leads");
}

export async function moveContactStage(formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim() || null;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;
  await assertPipelineAccess(session, contact.pipelineId);

  const stage = await prisma.stage.findUnique({ where: { id: stageId } });
  if (!stage || stage.pipelineId !== contact.pipelineId) return;

  // Only ever keep a reason while the contact actually sits in a rejected
  // stage - moving it anywhere else (including reactivating it) clears any
  // stale reason from a previous rejection.
  const nextRejectionReason = stage.isRejected ? rejectionReason : null;

  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { stageId, rejectionReason: nextRejectionReason } }),
    prisma.activity.create({
      data: {
        contactId,
        userId: session.user.id,
        type: "STAGE_CHANGE",
        content: nextRejectionReason
          ? `Stage geändert zu "${stage.name}" (Grund: ${nextRejectionReason})`
          : `Stage geändert zu "${stage.name}"`,
      },
    }),
  ]);

  await logAudit({
    action: "contact.stage_changed",
    entityType: "Contact",
    entityId: contactId,
    organizationId: (await prisma.pipeline.findUnique({ where: { id: contact.pipelineId } }))!.organizationId,
    userId: session.user.id,
    metadata: { stageId, rejectionReason: nextRejectionReason },
  });

  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
  revalidatePath("/dashboard/leads");
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
  revalidatePath("/dashboard/leads");
}

export async function updateContact(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

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
      companyName: companyName || null,
      website: website || deriveWebsiteFromEmail(email || null),
      address: address || null,
    },
  });

  revalidatePath(`/dashboard/pipelines/${contact.pipelineId}`);
  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath("/dashboard/leads");
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
  const companyName = String(formData.get("companyName") ?? "").trim();

  if (!firstName && !lastName && !email && !companyName) {
    return "Mindestens Name, Firma oder E-Mail ist erforderlich.";
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
      companyName: companyName || null,
      website: deriveWebsiteFromEmail(email || null),
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
        companyName: fields.companyName,
        website: deriveWebsiteFromEmail(fields.email),
        address: fields.address,
        cvUrl: fields.cvUrl,
        source: "MANUAL",
        customFields: stripTrackingFields((fields.customFields as Prisma.InputJsonObject | null) ?? row),
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

export async function addAdditionalContact(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return "Name ist erforderlich.";

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Kontakt nicht gefunden.";
  await assertPipelineAccess(session, contact.pipelineId);

  await prisma.additionalContact.create({
    data: { contactId, name, role: role || null, email: email || null, phone: phone || null },
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
}

export async function deleteAdditionalContact(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");

  const additionalContact = await prisma.additionalContact.findUnique({ where: { id }, include: { contact: true } });
  if (!additionalContact) return;
  await assertPipelineAccess(session, additionalContact.contact.pipelineId);

  await prisma.additionalContact.delete({ where: { id } });

  revalidatePath(`/dashboard/contacts/${additionalContact.contactId}`);
}
