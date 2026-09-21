"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export type StageTemplateStage = { name: string; order: number; color: string; isRejected: boolean; isFinal: boolean };

function parseStages(raw: string): StageTemplateStage[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    let sawFinal = false;
    return parsed.map((stage, index) => {
      // At most one final stage per template - the UI already enforces this
      // radio-style, but guard here too in case of stale/hand-edited payloads.
      const isFinal = !sawFinal && Boolean(stage.isFinal);
      if (isFinal) sawFinal = true;
      return {
        name: String(stage.name ?? "").trim(),
        order: index,
        color: String(stage.color ?? "#6B7280"),
        isRejected: Boolean(stage.isRejected),
        isFinal,
      };
    });
  } catch {
    return null;
  }
}

export async function createStageTemplate(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Vorlagen anlegen.";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Name ist erforderlich.";

  const stages = parseStages(String(formData.get("stages") ?? ""));
  if (!stages || stages.some((s) => !s.name)) return "Mindestens ein benannter Status ist erforderlich.";
  if (!stages.some((s) => s.isFinal)) {
    return "Bitte markiere eine Erfolgs-Stufe (Trophäe) - sonst werden Einstellungen/Abschlüsse nie gezählt.";
  }

  await prisma.stageTemplate.create({ data: { name, stages } });

  revalidatePath("/dashboard/settings");
}

export async function updateStageTemplate(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Vorlagen bearbeiten.";

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Name ist erforderlich.";

  const stages = parseStages(String(formData.get("stages") ?? ""));
  if (!stages || stages.some((s) => !s.name)) return "Mindestens ein benannter Status ist erforderlich.";
  if (!stages.some((s) => s.isFinal)) {
    return "Bitte markiere eine Erfolgs-Stufe (Trophäe) - sonst werden Einstellungen/Abschlüsse nie gezählt.";
  }

  await prisma.stageTemplate.update({ where: { id }, data: { name, stages } });

  revalidatePath("/dashboard/settings");
}

export async function deleteStageTemplate(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const id = String(formData.get("id") ?? "");
  await prisma.stageTemplate.delete({ where: { id } }).catch(() => {});

  revalidatePath("/dashboard/settings");
}
