"use server";

import { revalidatePath } from "next/cache";
import type { AutomationTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { AUTOMATION_TRIGGERS } from "@/lib/automation-labels";

/** Toggles a rule active/inactive, creating it on first use since rows only exist once configured. */
export async function toggleAutomationRule(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const trigger = String(formData.get("trigger") ?? "") as AutomationTrigger;
  const active = formData.get("active") === "true";
  if (!AUTOMATION_TRIGGERS.includes(trigger)) return;

  try {
    await assertPipelineAccess(session, pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return;
    throw error;
  }
  if (session.user.role === "CLIENT_STAFF") return;

  await prisma.automationRule.upsert({
    where: { pipelineId_trigger: { pipelineId, trigger } },
    update: { active },
    create: { pipelineId, trigger, active },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

/** Sets or clears a rule's recipient, creating it on first use like toggleAutomationRule. */
export async function updateAutomationRecipient(formData: FormData) {
  const session = await requireSession();
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const trigger = String(formData.get("trigger") ?? "") as AutomationTrigger;
  const recipientUserId = String(formData.get("recipientUserId") ?? "").trim() || null;
  if (!AUTOMATION_TRIGGERS.includes(trigger)) return;

  try {
    await assertPipelineAccess(session, pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return;
    throw error;
  }
  if (session.user.role === "CLIENT_STAFF") return;

  if (recipientUserId) {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { organizationId: true } });
    const recipient = await prisma.user.findUnique({ where: { id: recipientUserId }, select: { organizationId: true } });
    if (!pipeline || !recipient || recipient.organizationId !== pipeline.organizationId) return;
  }

  await prisma.automationRule.upsert({
    where: { pipelineId_trigger: { pipelineId, trigger } },
    update: { recipientUserId },
    create: { pipelineId, trigger, recipientUserId, active: false },
  });

  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}
