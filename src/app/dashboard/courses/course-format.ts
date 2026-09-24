/** Formats a "N Lektionen · M Min." meta line, matching LearningSuite's module/lesson summaries. */
export function formatLessonMeta(lessonCount: number, totalDurationSeconds: number): string {
  const parts = [`${lessonCount} ${lessonCount === 1 ? "Lektion" : "Lektionen"}`];
  if (totalDurationSeconds > 0) {
    parts.push(`${Math.round(totalDurationSeconds / 60)} Min.`);
  }
  return parts.join(" · ");
}
