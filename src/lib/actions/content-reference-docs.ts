"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor } from "@/lib/access";

function revalidateContentPaths(organizationId: string) {
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
}

/**
 * Wachsende Liste von Referenzlinks pro Kunde (Kunden-Onboarding-Formular,
 * Stellen-Onboardings, Mandatsakquise-Briefings, Fireflies-Transkripte aus
 * Content-Interviews etc.) - v1 speichert bewusst nur den Link, siehe
 * ContentReferenceDoc in schema.prisma.
 */
export async function addContentReferenceDoc(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Referenzdokumente hinzufügen.";
  }

  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!label || !url) return "Bezeichnung und Link sind erforderlich.";

  await prisma.contentReferenceDoc.create({ data: { organizationId, label, url } });
  revalidateContentPaths(organizationId);
  return undefined;
}

export async function deleteContentReferenceDoc(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const doc = await prisma.contentReferenceDoc.findUnique({ where: { id } });
  if (!doc) return;
  await assertCanManageSocialContentFor(session, doc.organizationId);

  await prisma.contentReferenceDoc.delete({ where: { id } });
  revalidateContentPaths(doc.organizationId);
}
