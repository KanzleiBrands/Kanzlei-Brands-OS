/**
 * The pipeline's actual "success" stage (eingestellt/gewonnen) - explicitly
 * marked via Stage.isFinal rather than inferred from stage order, since a
 * non-rejected stage appended after it (e.g. a separate "Verloren" stage)
 * would otherwise be mistaken for the real final stage. Mirrors the
 * equivalent logic in src/lib/dashboard-stats.ts. Returns undefined if no
 * stage is marked - the pipeline simply doesn't have one set yet.
 */
export function finalStageId(stages: { id: string; isFinal: boolean }[]): string | undefined {
  return stages.find((s) => s.isFinal)?.id;
}
