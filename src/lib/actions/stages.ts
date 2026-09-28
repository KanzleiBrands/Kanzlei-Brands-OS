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

/** Neue Kanban-Spalte am Ende der Pipeline anlegen - nur AGENCY_ADMIN, siehe reorderStages. */
export async function createStage(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    throw new AccessDeniedError("Nur die Agentur kann Stufen anlegen.");
  }

  const pipelineId = String(formData.get("pipelineId") ?? "");
  await assertPipelineAccess(session, pipelineId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Bitte einen Namen angeben.";

  const maxOrder = await prisma.stage.aggregate({ where: { pipelineId }, _max: { order: true } });
  await prisma.stage.create({
    data: { pipelineId, name, order: (maxOrder._max.order ?? -1) + 1 },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
  return undefined;
}

/**
 * Kanban-Spalte löschen - nur AGENCY_ADMIN, siehe reorderStages. Eine Stufe
 * mit Kontakten lässt sich bewusst nicht löschen (die Kontakte müssten sonst
 * mitgelöscht oder stillschweigend verschoben werden) - genauso wenig die
 * letzte verbleibende Stufe einer Pipeline.
 */
export async function deleteStage(formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    throw new AccessDeniedError("Nur die Agentur kann Stufen löschen.");
  }

  const stageId = String(formData.get("stageId") ?? "");
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { _count: { select: { contacts: true } } },
  });
  if (!stage) return "Stufe nicht gefunden.";
  await assertPipelineAccess(session, stage.pipelineId);

  if (stage._count.contacts > 0) {
    return `Diese Stufe hat noch ${stage._count.contacts} Kontakt(e) - erst verschieben oder löschen.`;
  }

  const stageCount = await prisma.stage.count({ where: { pipelineId: stage.pipelineId } });
  if (stageCount <= 1) {
    return "Die letzte Stufe einer Kampagne kann nicht gelöscht werden.";
  }

  await prisma.stage.delete({ where: { id: stageId } });

  revalidatePath(`/dashboard/pipelines/${stage.pipelineId}`);
  return undefined;
}
