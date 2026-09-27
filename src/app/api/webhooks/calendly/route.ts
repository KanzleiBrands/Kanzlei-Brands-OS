import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCampaignAndCreative, resolveCandidate } from "@/lib/attribution/resolve";
import type { JourneyEventType } from "@prisma/client";

/**
 * Zwei unabhängige Effekte bei jeder Terminbuchung:
 * 1. Fallout aus der E-Mail-Liste: sobald sich jemand einen Calendly-Termin
 *    bucht (egal welches Event/Kalender), gilt er als "live" und soll keine
 *    weiteren Marketing-Mails mehr bekommen - unabhängig davon, welcher
 *    Funnel ihn gerade bearbeitet.
 * 2. Candidate-Journey-Erfassung (Kampagnen-Reiter, siehe
 *    src/lib/attribution/): Calendlys eigenes UTM-Tracking-Objekt
 *    (payload.tracking) wird ausgewertet, um den Termin einer Kampagne
 *    zuzuordnen, und der Termin-Typ (Quali-/Sales-Call/Upsell) wird per
 *    Namens-Heuristik auf den passenden Meilenstein gemappt.
 *
 * Setup (durch den Nutzer, nicht durch diese Session möglich): in Calendly
 * unter "Integrations > Webhooks" einen Organization-Webhook auf
 * https://app.kanzlei-brands.de/api/webhooks/calendly für das Event
 * "invitee.created" anlegen, den dabei erzeugten Signing Key als
 * CALENDLY_WEBHOOK_SIGNING_KEY in Vercel setzen.
 */
function verifyCalendlySignature(rawBody: string, signatureHeader: string | null, signingKey: string): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const expected = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

type CalendlyEvent = {
  event?: string;
  payload?: {
    email?: string;
    name?: string;
    scheduled_event?: { name?: string; start_time?: string };
    event_type?: { name?: string };
    tracking?: {
      utm_campaign?: string | null;
      utm_source?: string | null;
      utm_medium?: string | null;
      utm_content?: string | null;
      utm_term?: string | null;
    };
  };
};

/** Grobe Namens-Heuristik, da Calendly-Event-Typ-Namen frei wählbar sind - deckt die bei Kanzlei Brands üblichen Terminarten ab. */
async function bookingJourneyType(candidateId: string, eventName: string): Promise<JourneyEventType | null> {
  const name = eventName.toLowerCase();
  if (name.includes("upsell")) return "UPSELL";
  if (name.includes("quali") || name.includes("erstgespräch")) return "QUALI_CALL_BOOKED";
  if (name.includes("sales") || name.includes("verkauf") || name.includes("strategiegespräch")) {
    const existingFirst = await prisma.journeyEvent.findFirst({ where: { candidateId, type: "SALES_CALL_1_BOOKED" } });
    return existingFirst ? "SALES_CALL_2_BOOKED" : "SALES_CALL_1_BOOKED";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

  if (!signingKey) {
    console.warn("[webhooks/calendly] CALENDLY_WEBHOOK_SIGNING_KEY nicht gesetzt - Event ignoriert.");
    return NextResponse.json({ ok: true, configured: false });
  }

  const signatureHeader = request.headers.get("calendly-webhook-signature");
  if (!verifyCalendlySignature(rawBody, signatureHeader, signingKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: CalendlyEvent;
  try {
    body = JSON.parse(rawBody) as CalendlyEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.event !== "invitee.created") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const email = body.payload?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const subscribers = await prisma.marketingSubscriber.findMany({ where: { email, status: "ACTIVE" } });
  for (const subscriber of subscribers) {
    await prisma.$transaction([
      prisma.marketingSubscriber.update({
        where: { id: subscriber.id },
        data: { status: "SUPPRESSED", suppressedAt: new Date(), suppressedReason: "calendly_booking" },
      }),
      prisma.marketingEnrollment.updateMany({
        where: { subscriberId: subscriber.id, status: "ACTIVE" },
        data: { status: "STOPPED", nextSendAt: null },
      }),
    ]);
  }

  let journeyEventCreated: JourneyEventType | null = null;
  try {
    const agency = await prisma.organization.findFirst({ where: { type: "AGENCY" }, select: { id: true } });
    const eventName = body.payload?.scheduled_event?.name ?? body.payload?.event_type?.name ?? "";
    if (agency && eventName) {
      const { candidateId } = await resolveCandidate(agency.id, email, body.payload?.name ?? null);
      const type = await bookingJourneyType(candidateId, eventName);
      if (type) {
        const tracking = body.payload?.tracking;
        const { campaignId, creativeId, platform } = await resolveCampaignAndCreative(agency.id, {
          utmSource: tracking?.utm_source ?? null,
          utmCampaign: tracking?.utm_campaign ?? null,
          utmContent: tracking?.utm_content ?? null,
          clickIdType: null,
        });
        if (campaignId) {
          await prisma.touchpoint.create({
            data: {
              organizationId: agency.id,
              anonymousVisitorId: `calendly-${candidateId}`,
              candidateId,
              platform,
              campaignId,
              creativeId,
              utmSource: tracking?.utm_source ?? null,
              utmMedium: tracking?.utm_medium ?? null,
              utmCampaign: tracking?.utm_campaign ?? null,
              utmContent: tracking?.utm_content ?? null,
              utmTerm: tracking?.utm_term ?? null,
              landingUrl: "calendly-booking",
            },
          });
        }
        const occurredAt = body.payload?.scheduled_event?.start_time ? new Date(body.payload.scheduled_event.start_time) : new Date();
        await prisma.journeyEvent.upsert({
          where: { candidateId_type: { candidateId, type } },
          create: { candidateId, type, occurredAt },
          update: { occurredAt },
        });
        journeyEventCreated = type;
      }
    }
  } catch (error) {
    console.error("[webhooks/calendly] journey capture failed", error);
  }

  return NextResponse.json({ ok: true, suppressed: subscribers.length, journeyEventCreated });
}
