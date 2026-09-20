import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/lib/email/resend";
import { contactDisplayName } from "@/lib/contact-display";
import { getBaseUrl } from "@/lib/base-url";
import { computeOverviewStats } from "@/lib/dashboard-stats";
import { logAudit } from "@/lib/audit";

const DAY_MS = 86_400_000;

type StatPipeline = {
  id: string;
  name: string;
  stages: { id: string; name: string; order: number; color: string | null }[];
  contacts: { id: string; stageId: string; createdAt: Date; updatedAt: Date }[];
};

function isLastDayOfMonth(date: Date) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

/** Contacts currently sitting in their pipeline's final stage, whose last change falls on/after `since`. */
function completedSince(pipelines: StatPipeline[], since: Date) {
  let count = 0;
  for (const pipeline of pipelines) {
    const sorted = [...pipeline.stages].sort((a, b) => a.order - b.order);
    if (sorted.length < 2) continue;
    const firstStageId = sorted[0].id;
    const lastStageId = sorted[sorted.length - 1].id;
    for (const contact of pipeline.contacts) {
      if (contact.stageId === lastStageId && contact.stageId !== firstStageId && contact.updatedAt >= since) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Polled once a day by Vercel Cron (see vercel.json). Bundles every
 * once-a-day job in one route instead of one cron entry each, since cron
 * job counts are capped on most Vercel plans:
 *  - Wiedervorlage (Task) reminder emails, once per task at/after dueAt.
 *  - Tages-Zusammenfassung an jeden Kunden (nur wenn es etwas zu berichten gibt).
 *  - Monats-Performance-Report an jeden Kunden, nur am letzten Tag des Monats.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = await getBaseUrl();
  const errors: string[] = [];

  // --- 1. Wiedervorlage-Erinnerungen -----------------------------------
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

  // --- 2. Tägliche Zusammenfassung je Kunde -----------------------------
  const clients = await prisma.organization.findMany({
    where: { type: "CLIENT", archivedAt: null },
    include: {
      users: { where: { role: "CLIENT_ADMIN" }, select: { email: true, name: true } },
      pipelines: {
        select: {
          id: true,
          name: true,
          stages: { select: { id: true, name: true, order: true, color: true } },
          contacts: { select: { id: true, stageId: true, createdAt: true, updatedAt: true } },
        },
      },
    },
  });

  let digestsSent = 0;
  const yesterday = new Date(now.getTime() - DAY_MS);

  for (const client of clients) {
    if (client.users.length === 0) continue;
    const stats = computeOverviewStats(client.pipelines);
    const newSinceYesterday = client.pipelines
      .flatMap((p) => p.contacts)
      .filter((c) => c.createdAt >= yesterday).length;

    if (newSinceYesterday === 0 && stats.unprocessed === 0 && stats.staleUnprocessed === 0) continue;

    const lines = [
      newSinceYesterday > 0 ? `${newSinceYesterday} neu seit gestern` : null,
      stats.unprocessed > 0 ? `${stats.unprocessed} unbearbeitet` : null,
      stats.staleUnprocessed > 0 ? `${stats.staleUnprocessed} davon seit über 3 Tagen offen` : null,
    ].filter(Boolean);

    const subject = `Kanzlei Brands: ${lines.join(", ")}`;
    const text = `Guten Morgen!\n\n${lines.join("\n")}\n\n${baseUrl}/dashboard/pipelines`;

    for (const user of client.users) {
      const result = await sendSystemEmail({ to: user.email, subject, text });
      if (!result.ok) {
        errors.push(`digest/${client.id}/${user.email}: ${result.error}`);
        continue;
      }
      digestsSent++;
    }
  }

  // --- 3. Monatlicher Performance-Report, nur am letzten Tag des Monats -
  let reportsSent = 0;
  if (isLastDayOfMonth(now)) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const client of clients) {
      if (!client.monthlyReportEnabled || client.users.length === 0) continue;

      const stats = computeOverviewStats(client.pipelines);
      const newThisMonth = client.pipelines
        .flatMap((p) => p.contacts)
        .filter((c) => c.createdAt >= monthStart).length;
      const completedThisMonth = completedSince(client.pipelines, monthStart);

      const monthLabel = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      const subject = `Dein Kanzlei Brands Report für ${monthLabel}`;
      const text = [
        `Dein Performance-Report für ${monthLabel}:`,
        "",
        `${newThisMonth} neue Leads/Bewerbungen`,
        `${completedThisMonth} abgeschlossen/eingestellt`,
        `${stats.unprocessed} aktuell unbearbeitet`,
        "",
        `${baseUrl}/dashboard/pipelines`,
      ].join("\n");

      for (const user of client.users) {
        const result = await sendSystemEmail({ to: user.email, subject, text });
        if (!result.ok) {
          errors.push(`report/${client.id}/${user.email}: ${result.error}`);
          continue;
        }
        reportsSent++;
      }

      await prisma.organization.update({ where: { id: client.id }, data: { lastReportSentAt: now } });
    }
  }

  // --- 4. DSGVO: abgelehnte Bewerber anonymisieren (nur wenn pro Recruiting-
  // Kampagne explizit aktiviert - siehe Kommentar an
  // updatePipelineDataRetention). Ein fehlendes E-Mail-Feld nach dem Lauf
  // markiert "bereits anonymisiert", damit ein Kontakt nicht bei jedem
  // Cron-Lauf erneut angefasst wird.
  let anonymized = 0;
  const retentionPipelines = await prisma.pipeline.findMany({
    where: { kind: "APPLICANTS", rejectedDataRetentionMonths: { not: null } },
    select: { id: true, organizationId: true, rejectedDataRetentionMonths: true },
  });

  for (const pipeline of retentionPipelines) {
    if (!pipeline.rejectedDataRetentionMonths) continue;

    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - pipeline.rejectedDataRetentionMonths);

    const staleRejected = await prisma.contact.findMany({
      where: {
        pipelineId: pipeline.id,
        stage: { isRejected: true },
        updatedAt: { lt: cutoff },
        email: { not: null },
      },
      select: { id: true },
    });

    for (const contact of staleRejected) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          firstName: "Anonymisiert",
          lastName: null,
          email: null,
          phone: null,
          address: null,
          cvUrl: null,
          customFields: {},
          companyName: null,
          website: null,
          talentPoolNote: null,
        },
      });
      await prisma.additionalContact.deleteMany({ where: { contactId: contact.id } });
      await logAudit({
        action: "contact.anonymized",
        entityType: "Contact",
        entityId: contact.id,
        organizationId: pipeline.organizationId,
        metadata: { reason: "rejected_data_retention", retentionMonths: pipeline.rejectedDataRetentionMonths, pipelineId: pipeline.id },
      });
      anonymized++;
    }
  }

  return NextResponse.json({ ok: true, taskRemindersSent, digestsSent, reportsSent, anonymized, errors });
}
