"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor } from "@/lib/access";

/**
 * Wiederverwendbare Textbausteine pro Kunde (Signaturen/CTAs/Hashtag-Sets) -
 * lassen sich im Post-Editor per Klick einfügen statt bei jedem Beitrag neu
 * getippt zu werden. Siehe ContentSnippet in schema.prisma.
 */

function isValidCategory(value: string): value is "SIGNATURE" | "CTA" | "HASHTAGS" | "OTHER" {
  return value === "SIGNATURE" || value === "CTA" || value === "HASHTAGS" || value === "OTHER";
}

function revalidateAll(organizationId: string) {
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
}

export async function addContentSnippet(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Textbausteine anlegen.";
  }

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return "Bezeichnung ist erforderlich.";
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return "Text ist erforderlich.";
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category = isValidCategory(categoryRaw) ? categoryRaw : "OTHER";

  await prisma.contentSnippet.create({ data: { organizationId, label, content, category } });

  revalidateAll(organizationId);
  return undefined;
}

export async function deleteContentSnippet(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const snippet = await prisma.contentSnippet.findUnique({ where: { id } });
  if (!snippet) return;
  try {
    await assertCanManageSocialContentFor(session, snippet.organizationId);
  } catch {
    return;
  }

  await prisma.contentSnippet.delete({ where: { id } });
  revalidateAll(snippet.organizationId);
}
