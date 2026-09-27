import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ClickIdType } from "@prisma/client";
import { resolveCampaignAndCreative, resolveCandidate } from "@/lib/attribution/resolve";

/**
 * Öffentlicher Tracking-Ingestion-Endpoint für das Snippet (public/tracking.js),
 * das auf den externen Landingpages von Kanzlei Brands eingebunden wird - NICHT
 * innerhalb dieses Portals. Bewusst ohne Auth/Consent-Gate (explizite Vorgabe
 * der Geschäftsführung, DSGVO-Einwilligung hier nicht zu berücksichtigen).
 * Cross-Origin: das Snippet sendet mit Content-Type text/plain, damit kein
 * CORS-Preflight nötig ist (der Request selbst kommt trotzdem an, die Antwort
 * wird vom Snippet ohnehin nicht ausgewertet).
 */

type CollectPayload = {
  orgId?: string;
  event?: "pageview" | "identify";
  anonymousVisitorId?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  clickIdType?: ClickIdType | null;
  clickIdValue?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  landingUrl?: string;
  referrerUrl?: string | null;
  email?: string;
  name?: string | null;
};

const VALID_CLICK_ID_TYPES: ClickIdType[] = ["FBCLID", "GCLID", "GBRAID", "WBRAID", "MSCLKID", "LI_FAT_ID"];

export async function POST(request: Request) {
  let payload: CollectPayload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return withCors(NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }));
  }

  if (!payload.orgId || !payload.anonymousVisitorId) {
    return withCors(NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 }));
  }

  const organization = await prisma.organization.findUnique({ where: { id: payload.orgId }, select: { id: true } });
  if (!organization) return withCors(NextResponse.json({ ok: false, error: "unknown_org" }, { status: 404 }));

  const clickIdType = payload.clickIdType && VALID_CLICK_ID_TYPES.includes(payload.clickIdType) ? payload.clickIdType : null;

  try {
    if (payload.event === "identify" && payload.email) {
      const { candidateId } = await resolveCandidate(organization.id, payload.email, payload.name ?? null);
      await prisma.touchpoint.updateMany({
        where: { organizationId: organization.id, anonymousVisitorId: payload.anonymousVisitorId, candidateId: null },
        data: { candidateId },
      });
      const existingLeadEvent = await prisma.journeyEvent.findFirst({ where: { candidateId, type: "LEAD_CREATED" } });
      if (!existingLeadEvent) {
        await prisma.journeyEvent.create({ data: { candidateId, type: "LEAD_CREATED", occurredAt: new Date() } });
      }
      return withCors(NextResponse.json({ ok: true }));
    }

    const { platform, campaignId, creativeId } = await resolveCampaignAndCreative(organization.id, {
      utmSource: payload.utmSource ?? null,
      utmCampaign: payload.utmCampaign ?? null,
      utmContent: payload.utmContent ?? null,
      clickIdType,
    });

    await prisma.touchpoint.create({
      data: {
        organizationId: organization.id,
        anonymousVisitorId: payload.anonymousVisitorId,
        platform,
        campaignId,
        creativeId,
        utmSource: payload.utmSource ?? null,
        utmMedium: payload.utmMedium ?? null,
        utmCampaign: payload.utmCampaign ?? null,
        utmContent: payload.utmContent ?? null,
        utmTerm: payload.utmTerm ?? null,
        clickIdType,
        clickIdValue: payload.clickIdValue ?? null,
        fbp: payload.fbp ?? null,
        fbc: payload.fbc ?? null,
        landingUrl: payload.landingUrl ?? "",
        referrerUrl: payload.referrerUrl ?? null,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });
    return withCors(NextResponse.json({ ok: true }));
  } catch (error) {
    console.error("[tracking] collect failed", error);
    return withCors(NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
