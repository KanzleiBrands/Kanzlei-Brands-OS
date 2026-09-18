type StatContact = { id: string; stageId: string; createdAt: Date; updatedAt: Date };
type StatStage = { id: string; name: string; order: number; color: string | null };
type StatPipeline = { id: string; name: string; organizationName?: string; stages: StatStage[]; contacts: StatContact[] };

export type OverviewStats = {
  totalContacts: number;
  newLast7Days: number;
  unprocessed: number;
  staleUnprocessed: number;
  inProgress: number;
  completedTotal: number;
  completedLast30Days: number;
  statusDistribution: { name: string; color: string; count: number }[];
};

const DAY_MS = 86_400_000;

export function computeOverviewStats(pipelines: StatPipeline[]): OverviewStats {
  const now = Date.now();
  let totalContacts = 0;
  let newLast7Days = 0;
  let unprocessed = 0;
  let staleUnprocessed = 0;
  let inProgress = 0;
  let completedTotal = 0;
  let completedLast30Days = 0;
  const distribution = new Map<string, { color: string; count: number }>();

  for (const pipeline of pipelines) {
    const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
    if (sortedStages.length === 0) continue;
    const firstStageId = sortedStages[0].id;
    const lastStageId = sortedStages[sortedStages.length - 1].id;
    const stageById = new Map(sortedStages.map((s) => [s.id, s]));

    for (const contact of pipeline.contacts) {
      totalContacts += 1;
      const ageMs = now - contact.createdAt.getTime();
      if (ageMs <= 7 * DAY_MS) newLast7Days += 1;

      const stage = stageById.get(contact.stageId);
      const bucket = distribution.get(stage?.name ?? "?") ?? {
        color: stage?.color ?? "#6B7280",
        count: 0,
      };
      bucket.count += 1;
      distribution.set(stage?.name ?? "?", bucket);

      if (contact.stageId === firstStageId) {
        unprocessed += 1;
        if (ageMs >= 2 * DAY_MS) staleUnprocessed += 1;
      } else if (contact.stageId === lastStageId) {
        completedTotal += 1;
        if (now - contact.updatedAt.getTime() <= 30 * DAY_MS) completedLast30Days += 1;
      } else {
        inProgress += 1;
      }
    }
  }

  return {
    totalContacts,
    newLast7Days,
    unprocessed,
    staleUnprocessed,
    inProgress,
    completedTotal,
    completedLast30Days,
    statusDistribution: Array.from(distribution.entries()).map(([name, v]) => ({ name, ...v })),
  };
}
