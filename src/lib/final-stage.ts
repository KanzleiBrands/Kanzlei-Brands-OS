/**
 * The pipeline's actual "success" stage (eingestellt/gewonnen): the
 * highest-order stage among the non-rejected ones. Assumes `stages` is
 * already ordered by `order` ascending (true for every query feeding this).
 * Mirrors the equivalent logic in src/lib/dashboard-stats.ts.
 */
export function finalStageId(stages: { id: string; isRejected: boolean }[]): string | undefined {
  const qualified = stages.filter((s) => !s.isRejected);
  return qualified[qualified.length - 1]?.id;
}
