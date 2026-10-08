"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Nur Agentur-Admins können Content-Formate verwalten.");
}

/** Agentur-weite Bibliothek wiederverwendbarer Formate für die KI-Ideen-Generierung - siehe src/lib/actions/content-ideas.ts. */
export async function listContentFormats() {
  return prisma.contentFormat.findMany({ orderBy: { name: "asc" } });
}

export async function createContentFormat(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const examples = String(formData.get("examples") ?? "").trim();
  if (!name || !description || !examples) return "Name, Beschreibung und Beispiele sind erforderlich.";

  await prisma.contentFormat.create({ data: { name, description, examples } });
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/intern/marketing/social");
  return undefined;
}

export async function updateContentFormat(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const examples = String(formData.get("examples") ?? "").trim();
  if (!name || !description || !examples) return "Name, Beschreibung und Beispiele sind erforderlich.";

  await prisma.contentFormat.update({ where: { id }, data: { name, description, examples } });
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/intern/marketing/social");
  return undefined;
}

export async function deleteContentFormat(formData: FormData) {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const id = String(formData.get("id") ?? "");
  await prisma.contentFormat.delete({ where: { id } });
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/intern/marketing/social");
}
