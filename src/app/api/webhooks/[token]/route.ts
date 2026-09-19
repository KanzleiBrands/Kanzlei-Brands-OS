import { NextRequest, NextResponse } from "next/server";
import type { Prisma, WebhookSource, ContactSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractContactFields } from "@/lib/webhook-ingest";
import { isFileUrl } from "@/lib/format-custom-fields";
import { storeFileFromUrl } from "@/lib/file-storage";

/** Re-hosts a file the source platform linked to under our own storage; keeps the original link if the download fails. */
async function mirrorExternalFile(url: string): Promise<string> {
  try {
    return await storeFileFromUrl(url, "leads");
  } catch {
    return url;
  }
}

const CONTACT_SOURCE_BY_WEBHOOK_SOURCE: Record<WebhookSource, ContactSource> = {
  GENERIC: "WEBHOOK_GENERIC",
  ZAPIER: "ZAPIER",
  GOOGLE_ADS: "GOOGLE_ADS",
  ONEPAGE: "ONEPAGE",
  PERSPEKTIVE: "PERSPEKTIVE",
  META_LEAD_ADS: "META_LEAD_ADS",
  LINKEDIN_LEAD_GEN: "LINKEDIN_LEAD_GEN",
  ELEMENTOR: "ELEMENTOR",
  TYPEFORM: "TYPEFORM",
  FUNNELCOCKPIT: "FUNNELCOCKPIT",
  HEYFLOW: "HEYFLOW",
  MEETOVO: "MEETOVO",
  AIDAFORM: "AIDAFORM",
  THRIVE: "THRIVE",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { token } });
  if (!endpoint || !endpoint.active) {
    return NextResponse.json({ error: "Unknown or inactive webhook" }, { status: 404 });
  }

  let payload: Prisma.InputJsonObject;
  try {
    payload = (await request.json()) as Prisma.InputJsonObject;
  } catch {
    await prisma.webhookDelivery.create({
      data: { endpointId: endpoint.id, rawPayload: {}, error: "Invalid JSON body" },
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const firstStage = await prisma.stage.findFirst({
      where: { pipelineId: endpoint.pipelineId },
      orderBy: { order: "asc" },
    });
    if (!firstStage) {
      throw new Error("Pipeline has no stages configured");
    }

    const fields = extractContactFields(payload, endpoint.fieldMapping as Record<string, string> | null);

    const cvUrl = fields.cvUrl ? await mirrorExternalFile(fields.cvUrl) : null;

    let customFields = fields.customFields;
    if (customFields) {
      const mirrored: Record<string, string> = {};
      for (const [key, value] of Object.entries(customFields)) {
        mirrored[key] = isFileUrl(value) ? await mirrorExternalFile(value) : value;
      }
      customFields = mirrored;
    }

    const contact = await prisma.contact.create({
      data: {
        pipelineId: endpoint.pipelineId,
        stageId: firstStage.id,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        phone: fields.phone,
        location: fields.location,
        cvUrl,
        source: CONTACT_SOURCE_BY_WEBHOOK_SOURCE[endpoint.source],
        customFields: (customFields as Prisma.InputJsonObject | null) ?? payload,
      },
    });

    await prisma.webhookDelivery.create({
      data: { endpointId: endpoint.id, rawPayload: payload, contactId: contact.id },
    });

    return NextResponse.json({ ok: true, contactId: contact.id }, { status: 201 });
  } catch (error) {
    await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        rawPayload: payload,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
