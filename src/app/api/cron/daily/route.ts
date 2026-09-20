import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { contactDisplayName } from "@/lib/contact-display";
import { getBaseUrl } from "@/lib/base-url";

/**
 * Polled once a day by Vercel Cron (see vercel.json). Bundles every
 * once-a-day job in one route instead of one cron entry each, since cron
 * job counts are capped on most Vercel plans:
 *  - Wiedervorlage (Task) reminder emails, once per task at/after dueAt.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = await getBaseUrl();
  const errors: string[] = [];

  const dueTasks = await prisma.task.findMany({
    where: { completedAt: null, reminderSentAt: null, dueAt: { lte: now }, assignedToUserId: { not: null } },
    include: { contact: true, assignedTo: { select: { email: true, name: true } } },
  });

  let taskRemindersSent = 0;
  for (const task of dueTasks) {
    if (!task.assignedTo) continue;
    const name = contactDisplayName(task.contact);
    const subject = `Wiedervorlage fällig: ${task.title}`;
    const text = `Deine Wiedervorlage "${task.title}" zu ${name} ist fällig.\n\n${baseUrl}/dashboard/contacts/${task.contactId}?tab=tasks`;

    const result = await sendSystemEmail({ to: task.assignedTo.email, subject, text });
    if (!result.ok) {
      errors.push(`task/${task.id}: ${result.error}`);
      continue;
    }
    await prisma.task.update({ where: { id: task.id }, data: { reminderSentAt: now } });
    taskRemindersSent++;
  }

  return NextResponse.json({ ok: true, taskRemindersSent, errors });
}
