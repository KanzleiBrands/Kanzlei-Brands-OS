import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmailViaAccount } from "@/lib/mailbox/send";
import { renderFunnelStepEmail } from "@/lib/funnels/render";

// A funnel activated for the first time with ON_NEW_LEAD shouldn't suddenly
// enroll every pre-existing contact in the campaign - mirrors the
// NEW_LEAD_WINDOW_HOURS guard in cron/automations.
const NEW_LEAD_WINDOW_HOURS = 48;

function hoursSince(date: Date, now: Date) {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

/**
 * Polled by Vercel Cron (see vercel.json). Two passes per run:
 * 1) auto-enrollment for ON_NEW_LEAD/ON_INACTIVITY funnels (MANUAL funnels
 *    are enrolled directly by the agency via enrollContacts()).
 * 2) sends the next due step for every ACTIVE enrollment whose nextSendAt
 *    has passed, then advances its cursor (or completes/stops it).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = await getBaseUrl();

  // --- Pass 1: auto-enrollment ---------------------------------------
  const autoFunnels = await prisma.nurtureFunnel.findMany({
    where: { active: true, triggerType: { in: ["ON_NEW_LEAD", "ON_INACTIVITY"] } },
    include: { steps: { orderBy: { order: "asc" }, take: 1 } },
  });

  let autoEnrolled = 0;
  for (const funnel of autoFunnels) {
    const firstStep = funnel.steps[0];
    if (!firstStep) continue;

    const contacts = await prisma.contact.findMany({
      where: { pipelineId: funnel.pipelineId, stage: { isRejected: false, isFinal: false } },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (contacts.length === 0) continue;

    const alreadyEnrolled = new Set(
      (await prisma.funnelEnrollment.findMany({ where: { funnelId: funnel.id }, select: { contactId: true } })).map(
        (e) => e.contactId,
      ),
    );

    const toEnroll: string[] = [];
    for (const contact of contacts) {
      if (alreadyEnrolled.has(contact.id)) continue;
      if (funnel.triggerType === "ON_NEW_LEAD") {
        if (hoursSince(contact.createdAt, now) <= NEW_LEAD_WINDOW_HOURS) toEnroll.push(contact.id);
      } else if (funnel.triggerType === "ON_INACTIVITY" && funnel.inactivityDays) {
        const lastActivityAt = contact.activities[0]?.createdAt ?? contact.createdAt;
        if (hoursSince(lastActivityAt, now) >= funnel.inactivityDays * 24) toEnroll.push(contact.id);
      }
    }
    if (toEnroll.length === 0) continue;

    const nextSendAt = new Date(now.getTime() + firstStep.delayDays * 24 * 60 * 60 * 1000);
    const result = await prisma.funnelEnrollment.createMany({
      data: toEnroll.map((contactId) => ({ funnelId: funnel.id, contactId, nextSendAt })),
      skipDuplicates: true,
    });
    autoEnrolled += result.count;
  }

  // --- Pass 2: send due steps ------------------------------------------
  const dueEnrollments = await prisma.funnelEnrollment.findMany({
    where: { status: "ACTIVE", nextSendAt: { lte: now } },
    include: { funnel: { include: { senderAccount: true } }, contact: { include: { stage: true } } },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const enrollment of dueEnrollments) {
    if (enrollment.contact.stage.isFinal || enrollment.contact.stage.isRejected) {
      await prisma.funnelEnrollment.update({ where: { id: enrollment.id }, data: { status: "STOPPED", nextSendAt: null } });
      continue;
    }
    if (!enrollment.funnel.active) continue; // paused - stays due, resumes once reactivated

    const contact = enrollment.contact;
    if (!contact.email) {
      await prisma.funnelEnrollment.update({ where: { id: enrollment.id }, data: { status: "STOPPED", nextSendAt: null } });
      errors.push(`${enrollment.id}: Kontakt hat keine E-Mail-Adresse`);
      continue;
    }

    const account = enrollment.funnel.senderAccount;
    if (!account) {
      errors.push(`${enrollment.funnelId}: Kein Absender-Postfach konfiguriert`);
      continue;
    }

    const nextStep = await prisma.funnelStep.findFirst({
      where: { funnelId: enrollment.funnelId, order: { gt: enrollment.currentStepOrder } },
      orderBy: { order: "asc" },
    });
    if (!nextStep) {
      await prisma.funnelEnrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", nextSendAt: null } });
      continue;
    }

    const trackingToken = randomUUID();
    const { subject, text, html } = renderFunnelStepEmail({
      step: nextStep,
      contact: { firstName: contact.firstName, lastName: contact.lastName, companyName: contact.companyName },
      baseUrl,
      trackingToken,
    });

    let providerMessageId: string;
    try {
      providerMessageId = await sendEmailViaAccount(account, { to: contact.email, subject, text, html });
    } catch (error) {
      errors.push(`${enrollment.id}/${nextStep.id}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const sentAt = new Date();
    const afterStep = await prisma.funnelStep.findFirst({
      where: { funnelId: enrollment.funnelId, order: { gt: nextStep.order } },
      orderBy: { order: "asc" },
    });

    await prisma.$transaction([
      prisma.funnelStepSend.create({ data: { trackingToken, enrollmentId: enrollment.id, stepId: nextStep.id, sentAt } }),
      prisma.emailMessage.create({
        data: {
          direction: "OUTBOUND",
          subject,
          bodyText: text,
          bodyHtml: html,
          fromAddress: account.email,
          toAddress: contact.email,
          providerMessageId,
          emailAccountId: account.id,
          contactId: contact.id,
          sentAt,
        },
      }),
      prisma.activity.create({ data: { contactId: contact.id, type: "EMAIL_OUT", content: subject } }),
      prisma.funnelEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStep.order,
          status: afterStep ? "ACTIVE" : "COMPLETED",
          nextSendAt: afterStep ? new Date(sentAt.getTime() + afterStep.delayDays * 24 * 60 * 60 * 1000) : null,
        },
      }),
    ]);
    sent++;
  }

  return NextResponse.json({ ok: true, autoEnrolled, sent, errors });
}
