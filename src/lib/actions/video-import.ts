"use server";

import { revalidatePath } from "next/cache";
import { list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { canManageCourse } from "@/lib/actions/courses";
import { VIDEO_IMPORT_PREFIX } from "@/lib/video-import-matching";

/** Lädt alle unter dem Video-Import-Präfix hochgeladenen Blobs, paginiert über den gesamten Store. */
export async function listVideoImportBlobs(): Promise<{ url: string; pathname: string; size: number; uploadedAt: string }[]> {
  const blobs: { url: string; pathname: string; size: number; uploadedAt: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: VIDEO_IMPORT_PREFIX, cursor, limit: 1000, token: process.env.BLOB_READ_WRITE_TOKEN });
    for (const b of page.blobs) {
      blobs.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt.toISOString() });
    }
    cursor = page.cursor;
  } while (cursor);
  return blobs;
}

/**
 * Übernimmt eine im UI bestätigte Video->Lektion-Zuordnung. Validiert pro
 * Zeile erneut serverseitig gegen die echten Blobs (nie der Client-Eingabe
 * vertrauen, welche blobUrl tatsächlich existiert) und gegen dieselbe
 * Berechtigung wie die übrige Kursverwaltung (canManageCourse) - ein
 * Kursmanager darf so z.B. nie das Video einer CLIENT-Lektion setzen.
 */
export async function applyVideoImportMapping(
  mappings: { blobUrl: string; lessonId: string }[],
): Promise<{ applied: number; skipped: string[] }> {
  const session = await requireSession();
  if (mappings.length === 0) return { applied: 0, skipped: [] };

  const validBlobs = await listVideoImportBlobs();
  const validUrls = new Set(validBlobs.map((b) => b.url));

  const skipped: string[] = [];
  let applied = 0;
  const revalidate = new Set<string>();

  for (const { blobUrl, lessonId } of mappings) {
    if (!validUrls.has(blobUrl)) {
      skipped.push(`${blobUrl}: keine gültige Video-Import-Datei`);
      continue;
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!lesson) {
      skipped.push(`${lessonId}: Lektion nicht gefunden`);
      continue;
    }
    if (!(await canManageCourse(session, lesson.module.course.audience))) {
      skipped.push(`${lesson.title}: keine Berechtigung`);
      continue;
    }

    await prisma.lesson.update({ where: { id: lessonId }, data: { videoUrl: blobUrl } });
    applied++;
    revalidate.add(`/dashboard/courses/${lesson.module.courseId}`);
  }

  revalidate.add("/dashboard/intern/schulung/verwaltung/video-import");
  for (const path of revalidate) revalidatePath(path);

  return { applied, skipped };
}
