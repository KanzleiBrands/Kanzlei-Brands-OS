"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor } from "@/lib/access";
import { storeFile } from "@/lib/file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

/**
 * Medien-Bibliothek pro Kunde (Konfiguration-Reiter) - Bilder werden einmal
 * (z.B. bereits in Canva passend zugeschnitten) auf einen Schlag hochgeladen
 * und im Post-Editor per Klick ausgewählt statt für jeden Beitrag einzeln
 * neu hochgeladen zu werden. Siehe MediaLibraryItem in schema.prisma.
 */

function revalidateAll(organizationId: string) {
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
}

export async function uploadMediaLibraryItems(formData: FormData): Promise<{ error: string } | { count: number }> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return { error: "Kunde ist erforderlich." };
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return { error: "Nur Agentur-Admins oder Marketing-Mitarbeiter können Bilder hochladen." };
  }

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Keine Dateien ausgewählt." };

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  let count = 0;
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) continue;
    const url = await storeFile(file, "media-library");
    await prisma.mediaLibraryItem.create({ data: { organizationId, url, tags } });
    count++;
  }

  if (count === 0) return { error: `Alle Dateien waren zu groß. Maximal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB pro Bild.` };

  revalidateAll(organizationId);
  return { count };
}

export async function deleteMediaLibraryItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const item = await prisma.mediaLibraryItem.findUnique({ where: { id } });
  if (!item) return;
  try {
    await assertCanManageSocialContentFor(session, item.organizationId);
  } catch {
    return;
  }

  await prisma.mediaLibraryItem.delete({ where: { id } });
  revalidateAll(item.organizationId);
}
