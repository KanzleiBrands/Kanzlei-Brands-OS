/**
 * Namens-Abgleich für den Video-Bulk-Import (siehe
 * /dashboard/intern/schulung/verwaltung/video-import): Admin/Kursmanager
 * lädt Videos direkt in den Vercel-Blob-Store unter dem Pfad-Präfix
 * `video-import/` hoch; diese Funktion schlägt pro Datei die vermutlich
 * gemeinte Lektion vor, per Ähnlichkeits-Score statt reiner exakter
 * Teilstring-Suche (Dateinamen haben oft zusätzliche Wörter, andere
 * Reihenfolge oder leicht andere Schreibweise als der Lektionstitel). Auch
 * ein "sicherer" Vorschlag wird nie blind übernommen - die Zuordnung muss im
 * UI erst bestätigt werden, bevor Lesson.videoUrl gesetzt wird.
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
  /** Ähnlichkeit (0-1) des besten Kandidaten - 0 bei "kein_treffer". */
  score: number;
};

const SURE_THRESHOLD = 0.95;
const UNSURE_THRESHOLD = 0.45;
const AMBIGUOUS_MARGIN = 0.05;

/** ä/ö/ü/ß -> ae/oe/ue/ss, lowercase, Extension/Pfad/Sonderzeichen weg, führende Nummerierung ("1 ", "10 ") weg (Dateiposition, nicht Teil des Titels), Whitespace normalisiert. */
export function normalizeForMatching(input: string): string {
  const basename = input.split("/").pop() ?? input;
  const withoutExtension = basename.replace(/\.[a-zA-Z0-9]{1,5}$/, "");
  const normalized = withoutExtension
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
  return normalized.replace(/^\d+\s+/, "");
}

function bigrams(s: string): string[] {
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

/** Sørensen-Dice-Koeffizient auf Zeichen-Bigrammen (0-1) - verzeiht Tippfehler/leicht andere Schreibweise. */
function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const counts = new Map<string, number>();
  for (const g of bigramsB) counts.set(g, (counts.get(g) ?? 0) + 1);
  let intersection = 0;
  for (const g of bigramsA) {
    const count = counts.get(g) ?? 0;
    if (count > 0) {
      intersection++;
      counts.set(g, count - 1);
    }
  }
  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

/** Anteil der Wörter des kürzeren Titels, die im längeren vorkommen (0-1) - erkennt "Titel steckt komplett im Dateinamen", auch wenn der Dateiname zusätzliche Wörter drumherum hat. */
function tokenContainmentRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t)).length;
  return shared / Math.min(a.length, b.length);
}

/** Kombinierte Ähnlichkeit (0-1) zweier bereits normalisierter Titel - das Maximum aus Bigramm-Ähnlichkeit und Wort-Enthaltensein, damit sowohl leichte Schreibvarianten als auch "Titel + Zusatzwörter" gut erkannt werden. */
export function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const dice = diceCoefficient(a, b);
  const containment = tokenContainmentRatio(a.split(" ").filter(Boolean), b.split(" ").filter(Boolean));
  return Math.max(dice, containment);
}

export function matchVideoImportBlobs(
  blobs: VideoImportBlob[],
  lessons: VideoImportLessonCandidate[],
): VideoImportMatch[] {
  const normalizedLessons = lessons.map((lesson) => ({ lesson, key: normalizeForMatching(lesson.title) }));

  return blobs.map((blob) => {
    const filename = blob.pathname.split("/").pop() ?? blob.pathname;
    const key = normalizeForMatching(blob.pathname);

    const scored = normalizedLessons
      .map((l) => ({ lesson: l.lesson, score: titleSimilarity(key, l.key) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < UNSURE_THRESHOLD) {
      return { blob, filename, status: "kein_treffer", suggestedLessonId: null, candidates: [], score: 0 };
    }

    const closeRivals = scored.filter((s) => s.score >= best.score - AMBIGUOUS_MARGIN);
    if (closeRivals.length > 1) {
      return {
        blob,
        filename,
        status: "mehrdeutig",
        suggestedLessonId: null,
        candidates: closeRivals.map((s) => s.lesson),
        score: best.score,
      };
    }

    return {
      blob,
      filename,
      status: best.score >= SURE_THRESHOLD ? "sicher" : "unsicher",
      suggestedLessonId: best.lesson.id,
      candidates: [best.lesson],
      score: best.score,
    };
  });
}
