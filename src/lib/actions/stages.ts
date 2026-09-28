"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";

/**
 * Kanban-Spalten (Stage) einer Pipeline neu anordnen - z.B. nach einem
 * CSV-Import, der neue Stufen ans Ende angehängt hat (siehe
 * importContactsCsv). Wie deleteContact auf AGENCY_ADMIN beschränkt: die
 * Pipeline-Struktur selbst ist eine Agentur-Konfiguration, kein Kunden-
 * Workflow-Schritt.
 */
export async function reorderStages(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    throw new AccessDeniedError("Nur die Agentur kann Stufen umsortieren.");
  }

  const pipelineId = String(formData.get("pipelineId") ?? "");
  await assertPipelineAccess(session, pipelineId);

  let orderedStageIds: string[];
  try {
    orderedStageIds = JSON.parse(String(formData.get("stageIds") ?? "[]"));
  } catch {
    return "Ungültige Reihenfolge.";
  }
  if (orderedStageIds.length === 0) return undefined;

  const stages = await prisma.stage.findMany({ where: { pipelineId }, select: { id: true } });
  const validIds = new Set(stages.map((s) => s.id));
  if (orderedStageIds.some((id) => !validIds.has(id))) return "Ungültige Stufe.";

  await prisma.$transaction(orderedStageIds.map((id, index) => prisma.stage.update({ where: { id }, data: { order: index } })));

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  return undefined;
}
