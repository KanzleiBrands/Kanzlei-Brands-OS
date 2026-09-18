"use server";

import { revalidatePath } from "next/cache";
import type { WebhookSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";
import { WEBHOOK_SOURCES } from "@/lib/webhook-source-labels";

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

export async function createWebhookEndpoint(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const source = String(formData.get("source") ?? "");

  if (!WEBHOOK_SOURCES.includes(source as (typeof WEBHOOK_SOURCES)[number])) {
    return "Ungültige Quelle.";
  }

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return "Pipeline nicht gefunden.";
  await assertPipelineAccess(session, pipelineId);
  if (session.user.role === "CLIENT_STAFF") return "Nur Admins können Quellen hinzufügen.";

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { pipelineId, source: source as WebhookSource },
  });
  if (existing) return "Diese Quelle ist für diese Pipeline bereits eingerichtet.";

  await prisma.webhookEndpoint.create({
    data: { source: source as WebhookSource, organizationId: pipeline.organizationId, pipelineId },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}
