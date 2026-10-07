/**
 * Reiner Namens-Abgleich für den Video-Bulk-Import (siehe
 * /dashboard/intern/schulung/verwaltung/video-import): Admin/Kursmanager
 * lädt Videos direkt in den Vercel-Blob-Store unter dem Pfad-Präfix
 * `video-import/` hoch; diese Funktion schlägt pro Datei die vermutlich
 * gemeinte Lektion vor, basierend darauf, dass Dateien und Lektionen
 * identisch benannt wurden. Nie blind automatisch übernehmen - der Vorschlag
 * muss im UI bestätigt werden, bevor Lesson.videoUrl gesetzt wird.
 */

export const VIDEO_IMPORT_PREFIX = "video-import/";

export type VideoImportLessonCandidate = {
  id: string;
  title: string;
  courseTitle: string;
  moduleTitle: string;
  audience: "CLIENT" | "INTERNAL";
  hasVideo: boolean;
};

export type VideoImportBlob = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

export type VideoImportMatch = {
  blob: VideoImportBlob;
  filename: string;
  status: "sicher" | "unsicher" | "mehrdeutig" | "kein_treffer";
  suggestedLessonId: string | null;
  candidates: VideoImportLessonCandidate[];
};

/** ä/ö/ü/ß -> ae/oe/ue/ss (gängige dateisystemsichere Transliteration), dann lowercase, Extension/Pfad/Sonderzeichen weg, Whitespace normalisiert. */
export function normalizeForMatching(input: string): string {
  const basename = input.split("/").pop() ?? input;
  const withoutExtension = basename.replace(/\.[a-zA-Z0-9]{1,5}$/, "");
  return withoutExtension
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchVideoImportBlobs(
  blobs: VideoImportBlob[],
  lessons: VideoImportLessonCandidate[],
): VideoImportMatch[] {
  const normalizedLessons = lessons.map((lesson) => ({ lesson, key: normalizeForMatching(lesson.title) }));

  return blobs.map((blob) => {
    const filename = blob.pathname.split("/").pop() ?? blob.pathname;
    const key = normalizeForMatching(blob.pathname);

    const exact = normalizedLessons.filter((l) => l.key === key);
    if (exact.length === 1) {
      return { blob, filename, status: "sicher", suggestedLessonId: exact[0].lesson.id, candidates: [exact[0].lesson] };
    }
    if (exact.length > 1) {
      return {
        blob,
        filename,
        status: "mehrdeutig",
        suggestedLessonId: null,
        candidates: exact.map((l) => l.lesson),
      };
    }

    const fuzzy = normalizedLessons.filter((l) => key.includes(l.key) || l.key.includes(key));
    if (fuzzy.length === 1) {
      return { blob, filename, status: "unsicher", suggestedLessonId: fuzzy[0].lesson.id, candidates: [fuzzy[0].lesson] };
    }
    if (fuzzy.length > 1) {
      return { blob, filename, status: "mehrdeutig", suggestedLessonId: null, candidates: fuzzy.map((l) => l.lesson) };
    }

    return { blob, filename, status: "kein_treffer", suggestedLessonId: null, candidates: [] };
  });
}
