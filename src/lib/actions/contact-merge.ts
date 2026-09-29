"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { contactDisplayName } from "@/lib/contact-display";

const MERGE_FIELDS = ["firstName", "lastName", "email", "phone", "companyName", "website", "address", "location", "cvUrl"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

export type MergeCandidateContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  address: string | null;
  location: string | null;
  cvUrl: string | null;
  stageName: string;
  createdAt: string;
};

export type DuplicateCandidatesResult =
  | { ok: true; contact: MergeCandidateContact; candidates: MergeCandidateContact[] }
  | { ok: false; error: string };

function toCandidate(contact: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  address: string | null;
  location: string | null;
  cvUrl: string | null;
  createdAt: Date;
  stage: { name: string };
}): MergeCandidateContact {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    companyName: contact.companyName,
    website: contact.website,
    address: contact.address,
    location: contact.location,
    cvUrl: contact.cvUrl,
    stageName: contact.stage.name,
    createdAt: contact.createdAt.toISOString(),
  };
}

/** Andere Kontakte in derselben Pipeline, die dieselbe E-Mail oder Telefonnummer tragen (siehe findDuplicateContacts). */
export async function getDuplicateCandidates(contactId: string): Promise<DuplicateCandidatesResult> {
  const session = await requireSession();
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { stage: { select: { name: true } } } });
  if (!contact) return { ok: false, error: "Kontakt nicht gefunden." };

  try {
    await assertPipelineAccess(session, contact.pipelineId);
  } catch (error) {
    return { ok: false, error: error instanceof AccessDeniedError ? error.message : "Kein Zugriff." };
  }

  const email = contact.email?.trim();
  const phone = contact.phone?.trim();
  if (!email && !phone) return { ok: true, contact: toCandidate(contact), candidates: [] };

  const candidates = await prisma.contact.findMany({
    where: {
      pipelineId: contact.pipelineId,
      id: { not: contactId },
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    include: { stage: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return { ok: true, contact: toCandidate(contact), candidates: candidates.map(toCandidate) };
}

/**
 * Führt zwei Duplikate zusammen: mergeContactId wird gelöscht, ausgewählte
 * Felder werden auf keepContactId übernommen (field_<Feldname>=merge in
 * formData wählt jeweils den Wert des zu löschenden Kontakts, sonst bleibt
 * der Wert von keepContactId erhalten). Notizen/Aktivitäten/Aufgaben/
 * E-Mails/Zusatzfelder beider Kontakte werden auf keepContactId
 * zusammengeführt, nicht verworfen.
 */
export async function mergeContacts(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    return "Nur die Agentur kann Kontakte zusammenführen.";
  }

  const keepContactId = String(formData.get("keepContactId") ?? "");
  const mergeContactId = String(formData.get("mergeContactId") ?? "");
  if (!keepContactId || !mergeContactId || keepContactId === mergeContactId) return "Ungültige Auswahl.";

  const [keep, merge] = await Promise.all([
    prisma.contact.findUnique({ where: { id: keepContactId } }),
    prisma.contact.findUnique({ where: { id: mergeContactId } }),
  ]);
  if (!keep || !merge) return "Kontakt nicht gefunden.";
  if (keep.pipelineId !== merge.pipelineId) return "Kontakte gehören zu unterschiedlichen Kampagnen.";

  try {
    await assertPipelineAccess(session, keep.pipelineId);
  } catch (error) {
    return error instanceof AccessDeniedError ? error.message : "Kein Zugriff.";
  }

  const data: Prisma.ContactUpdateInput = {};
  for (const field of MERGE_FIELDS) {
    const choice = String(formData.get(`field_${field}`) ?? "keep");
    if (choice === "merge") (data as Record<string, unknown>)[field] = merge[field];
  }

  const keepCustom =
    keep.customFields && typeof keep.customFields === "object" && !Array.isArray(keep.customFields)
      ? (keep.customFields as Record<string, unknown>)
      : {};
  const mergeCustom =
    merge.customFields && typeof merge.customFields === "object" && !Array.isArray(merge.customFields)
      ? (merge.customFields as Record<string, unknown>)
      : {};
  // keep-Werte gewinnen bei überschneidenden Schlüsseln - merge füllt nur auf.
  data.customFields = { ...mergeCustom, ...keepCustom } as Prisma.InputJsonValue;

  await prisma.$transaction(async (tx) => {
    // Bei ruleId/funnelId+contactId-eindeutigen Tabellen zuerst die Zeilen des
    // zu löschenden Kontakts entfernen, die mit einer bereits vorhandenen
    // Zeile des Zielkontakts kollidieren würden - sonst schlägt die
    // Umhängung unten am Unique-Constraint fehl.
    const keepRuleIds = (await tx.automationLog.findMany({ where: { contactId: keepContactId }, select: { ruleId: true } })).map(
      (r) => r.ruleId,
    );
    if (keepRuleIds.length > 0) {
      await tx.automationLog.deleteMany({ where: { contactId: mergeContactId, ruleId: { in: keepRuleIds } } });
    }
    const keepFunnelIds = (
      await tx.funnelEnrollment.findMany({ where: { contactId: keepContactId }, select: { funnelId: true } })
    ).map((r) => r.funnelId);
    if (keepFunnelIds.length > 0) {
      await tx.funnelEnrollment.deleteMany({ where: { contactId: mergeContactId, funnelId: { in: keepFunnelIds } } });
    }

    await tx.additionalContact.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.activity.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.webhookDelivery.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.metaLeadDelivery.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.automationLog.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.task.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.emailMessage.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });
    await tx.funnelEnrollment.updateMany({ where: { contactId: mergeContactId }, data: { contactId: keepContactId } });

    await tx.activity.create({
      data: {
        contactId: keepContactId,
        userId: session.user.id,
        type: "NOTE",
        content: `Zusammengeführt mit Duplikat "${contactDisplayName(merge)}" (${merge.email ?? merge.phone ?? merge.id}).`,
      },
    });

    await tx.contact.update({ where: { id: keepContactId }, data });
    await tx.contact.delete({ where: { id: mergeContactId } });
  });

  await logAudit({
    action: "contacts.merged",
    entityType: "Contact",
    entityId: keepContactId,
    organizationId: (await prisma.pipeline.findUnique({ where: { id: keep.pipelineId } }))!.organizationId,
    userId: session.user.id,
    metadata: { mergedContactId: mergeContactId },
  });

  revalidatePath(`/dashboard/pipelines/${keep.pipelineId}`);
  revalidatePath(`/dashboard/contacts/${keepContactId}`);
  return undefined;
}
