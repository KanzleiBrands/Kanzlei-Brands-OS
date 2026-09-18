"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";

export async function updateFieldMapping(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const endpointId = String(formData.get("endpointId") ?? "");
  const raw = String(formData.get("fieldMapping") ?? "").trim();

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint) return "Webhook nicht gefunden.";
  await assertPipelineAccess(session, endpoint.pipelineId);

  let parsed: Record<string, string> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return "Ungültiges JSON.";
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return "Das Mapping muss ein JSON-Objekt sein.";
    }
  }

  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { fieldMapping: parsed },
  });

  revalidatePath(`/dashboard/pipelines/${endpoint.pipelineId}`);
}
