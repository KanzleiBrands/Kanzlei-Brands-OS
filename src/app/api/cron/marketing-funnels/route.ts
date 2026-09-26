import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmailViaAccount } from "@/lib/mailbox/send";
import { renderFunnelStepEmail } from "@/lib/funnels/render";
import { syncFunnelSendToClose } from "@/lib/close/client";

/**
 * Polled by Vercel Cron - sendet fällige Schritte des internen E-Mail-
 * Marketing-Tools (MarketingEnrollment/-Subscriber, siehe schema.prisma).
 * Analog zu cron/funnels, aber getrennt: Empfänger sind MarketingSubscriber
 * statt Contact, Einschreibung passiert ausschließlich über Tags
 * (applyTag()) oder manuell, nie automatisch über Kampagnen-Trigger.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = await getBaseUrl();

  const dueEnrollments = await prisma.marketingEnrollment.findMany({
    where: { status: "ACTIVE", nextSendAt: { lte: now } },
    include: { funnel: { include: { senderAccount: true } }, subscriber: true },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const enrollment of dueEnrollments) {
    if (enrollment.subscriber.status === "SUPPRESSED") {
      await prisma.marketingEnrollment.update({ where: { id: enrollment.id }, data: { status: "STOPPED", nextSendAt: null } });
      continue;
    }
    if (!enrollment.funnel.active) continue; // paused - stays due, resumes once reactivated

    const account = enrollment.funnel.senderAccount;
    if (!account) {
      errors.push(`${enrollment.funnelId}: Kein Absender-Postfach konfiguriert`);
      continue;
    }

    const nextStep = await prisma.marketingFunnelStep.findFirst({
      where: { funnelId: enrollment.funnelId, order: { gt: enrollment.currentStepOrder } },
      orderBy: { order: "asc" },
    });
    if (!nextStep) {
      await prisma.marketingEnrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", nextSendAt: null } });
      continue;
    }

    const subscriber = enrollment.subscriber;
    const trackingToken = randomUUID();
    const { subject, text, html } = renderFunnelStepEmail({
      step: nextStep,
      contact: { firstName: subscriber.firstName, lastName: subscriber.lastName, companyName: null },
      baseUrl,
      trackingToken,
    });

    try {
      // Kein EmailMessage-Log hier - Subscriber ist kein Contact, siehe MarketingFunnelSend statt EmailMessage.
      await sendEmailViaAccount(account, { to: subscriber.email, subject, text, html });
    } catch (error) {
      errors.push(`${enrollment.id}/${nextStep.id}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const sentAt = new Date();
    const afterStep = await prisma.marketingFunnelStep.findFirst({
      where: { funnelId: enrollment.funnelId, order: { gt: nextStep.order } },
      orderBy: { order: "asc" },
    });

    await prisma.$transaction([
      prisma.marketingFunnelSend.create({ data: { trackingToken, enrollmentId: enrollment.id, stepId: nextStep.id, sentAt } }),
      prisma.marketingEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStep.order,
          status: afterStep ? "ACTIVE" : "COMPLETED",
          nextSendAt: afterStep ? new Date(sentAt.getTime() + afterStep.delayDays * 24 * 60 * 60 * 1000) : null,
        },
      }),
    ]);
    sent++;

    await syncFunnelSendToClose(subscriber.id, subject);
  }

  return NextResponse.json({ ok: true, sent, errors });
}
