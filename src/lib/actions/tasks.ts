"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";

async function contactPipelineId(contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { pipelineId: true } });
  if (!contact) throw new Error("Kontakt nicht gefunden.");
  return contact.pipelineId;
}

export async function createTask(_prevState: string | undefined, formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const repeatIntervalDaysRaw = String(formData.get("repeatIntervalDays") ?? "").trim();

  if (!contactId || !title || !dueAtRaw) return "Titel und Fälligkeitsdatum sind erforderlich.";

  const dueAt = new Date(dueAtRaw);
  if (Number.isNaN(dueAt.getTime())) return "Ungültiges Fälligkeitsdatum.";

  const repeatIntervalDays = repeatIntervalDaysRaw ? Number(repeatIntervalDaysRaw) : null;
  if (repeatIntervalDays !== null && (!Number.isInteger(repeatIntervalDays) || repeatIntervalDays <= 0)) {
    return "Ungültiges Wiederholungsintervall.";
  }

  const pipelineId = await contactPipelineId(contactId);
  await assertPipelineAccess(session, pipelineId);

  await prisma.task.create({
    data: {
      contactId,
      title,
      dueAt,
      repeatIntervalDays,
      createdByUserId: session.user.id,
      assignedToUserId: session.user.id,
    },
  });

  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath("/dashboard/tasks");
}

export async function completeTask(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId") ?? "");

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { contact: true } });
  if (!task) return;
  await assertPipelineAccess(session, task.contact.pipelineId);

  const completedAt = new Date();
  await prisma.task.update({ where: { id: taskId }, data: { completedAt } });

  if (task.repeatIntervalDays) {
    const nextDueAt = new Date(completedAt.getTime() + task.repeatIntervalDays * 24 * 60 * 60 * 1000);
    await prisma.task.create({
      data: {
        contactId: task.contactId,
        title: task.title,
        dueAt: nextDueAt,
        repeatIntervalDays: task.repeatIntervalDays,
        createdByUserId: task.createdByUserId,
        assignedToUserId: task.assignedToUserId,
      },
    });
  }

  revalidatePath(`/dashboard/contacts/${task.contactId}`);
  revalidatePath("/dashboard/tasks");
}

export async function reopenTask(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId") ?? "");

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { contact: true } });
  if (!task) return;
  await assertPipelineAccess(session, task.contact.pipelineId);

  await prisma.task.update({ where: { id: taskId }, data: { completedAt: null } });

  revalidatePath(`/dashboard/contacts/${task.contactId}`);
  revalidatePath("/dashboard/tasks");
}

export async function deleteTask(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId") ?? "");

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { contact: true } });
  if (!task) return;
  await assertPipelineAccess(session, task.contact.pipelineId);

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath(`/dashboard/contacts/${task.contactId}`);
  revalidatePath("/dashboard/tasks");
}
