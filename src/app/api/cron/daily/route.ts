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
  stages: { id: string; name: string; order: number; color: string | null; isRejected: boolean; isFinal: boolean }[];
  contacts: { id: string; stageId: string; createdAt: Date; updatedAt: Date }[];
};

function isLastDayOfMonth(date: Date) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

/** Contacts currently sitting in their pipeline's explicit final stage (Stage.isFinal), whose last change falls on/after `since`. */
function completedSince(pipelines: StatPipeline[], since: Date) {
  let count = 0;
  for (const pipeline of pipelines) {
    const lastStageId = pipeline.stages.find((s) => s.isFinal)?.id;
    if (!lastStageId) continue;
    for (const contact of pipeline.contacts) {
      if (contact.stageId === lastStageId && contact.updatedAt >= since) {
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
          stages: { select: { id: true, name: true, order: true, color: true, isRejected: true, isFinal: true } },
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

  // --- 4. DSGVO: Kontakte in einer Ungeeignet-Stufe vollständig löschen
  // (nicht nur anonymisieren - siehe Kommentar an updateDataRetentionSettings).
  // Kundenweit statt pro Kampagne konfiguriert, getrennt nach Bewerbern
  // (Recruiting) und Mandatsanfragen (Mandatsakquise). Läuft unabhängig vom
  // Archiv-Status eines Kunden, da die Löschpflicht dadurch nicht entfällt.
  let deletedApplicants = 0;
  let deletedLeads = 0;
  const retentionOrgs = await prisma.organization.findMany({
    where: {
      type: "CLIENT",
      OR: [{ applicantDataRetentionMonths: { not: null } }, { leadDataRetentionMonths: { not: null } }],
    },
    select: {
      id: true,
      applicantDataRetentionMonths: true,
      leadDataRetentionMonths: true,
      pipelines: { select: { id: true, kind: true } },
    },
  });

  for (const org of retentionOrgs) {
    const retentionByKind = [
      { kind: "APPLICANTS" as const, months: org.applicantDataRetentionMonths, reason: "applicant_data_retention" },
      { kind: "LEADS" as const, months: org.leadDataRetentionMonths, reason: "lead_data_retention" },
    ];

    for (const { kind, months, reason } of retentionByKind) {
      if (!months) continue;

      const pipelineIds = org.pipelines.filter((p) => p.kind === kind).map((p) => p.id);
      if (pipelineIds.length === 0) continue;

      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - months);

      const staleContacts = await prisma.contact.findMany({
        where: { pipelineId: { in: pipelineIds }, stage: { isRejected: true }, updatedAt: { lt: cutoff } },
        select: { id: true },
      });

      for (const contact of staleContacts) {
        await prisma.contact.delete({ where: { id: contact.id } });
        await logAudit({
          action: "contact.deleted",
          entityType: "Contact",
          entityId: contact.id,
          organizationId: org.id,
          metadata: { reason, retentionMonths: months },
        });
        if (kind === "APPLICANTS") deletedApplicants++;
        else deletedLeads++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    taskRemindersSent,
    digestsSent,
    reportsSent,
    deletedApplicants,
    deletedLeads,
    errors,
  });
}
