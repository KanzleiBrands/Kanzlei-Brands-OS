/** The page-builder content blocks a lesson can be made of, stored as Lesson.content (JSON). */
export type LessonBlock =
  | { id: string; type: "heading"; level: 2 | 3; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; url: string; caption: string };

/** Parses Lesson.content (unknown JSON from the DB) back into a safe LessonBlock[], dropping anything malformed. */
export function parseLessonBlocks(content: unknown): LessonBlock[] {
  if (!Array.isArray(content)) return [];
  const blocks: LessonBlock[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    if (typeof b.id !== "string") continue;
    if (b.type === "heading" && typeof b.text === "string" && (b.level === 2 || b.level === 3)) {
      blocks.push({ id: b.id, type: "heading", level: b.level, text: b.text });
    } else if (b.type === "paragraph" && typeof b.text === "string") {
      blocks.push({ id: b.id, type: "paragraph", text: b.text });
    } else if (b.type === "image" && typeof b.url === "string") {
      blocks.push({ id: b.id, type: "image", url: b.url, caption: typeof b.caption === "string" ? b.caption : "" });
    }
  }
  return blocks;
}
