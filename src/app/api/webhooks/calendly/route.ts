import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Fallout aus der E-Mail-Liste: sobald sich jemand einen Calendly-Termin
 * bucht (egal welches Event/Kalender), gilt er als "live" und soll keine
 * weiteren Marketing-Mails mehr bekommen - unabhängig davon, welcher Funnel
 * ihn gerade bearbeitet.
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
  payload?: { email?: string };
};

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

  return NextResponse.json({ ok: true, suppressed: subscribers.length });
}
