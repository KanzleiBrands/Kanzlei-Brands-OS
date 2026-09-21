import { NextRequest, NextResponse } from "next/server";
import type { Prisma, WebhookSource, ContactSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  extractCallDurationSeconds,
  extractContactFields,
  resolveLocationRoutingPipelineId,
  stripTrackingFields,
} from "@/lib/webhook-ingest";
import { isFileUrl } from "@/lib/format-custom-fields";
import { storeFileFromUrl } from "@/lib/file-storage";
import { deriveWebsiteFromEmail } from "@/lib/company";
import { handleNewContactCreated } from "@/lib/notify-new-contact";

/** Re-hosts a file the source platform linked to under our own storage; keeps the original link if the download fails. */
async function mirrorExternalFile(url: string): Promise<string> {
  try {
    return await storeFileFromUrl(url, "leads");
  } catch (error) {
    console.error("[webhook] mirrorExternalFile failed, keeping original link:", url, error);
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
  MATELSO: "MATELSO",
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
    // Multi-location jobs sharing one funnel/webhook: if the payload's
    // location answer matches this endpoint's routing config, file the
    // contact under that sibling pipeline instead of the endpoint's own -
    // but only when it's a real pipeline in the same organization, in case
    // the routing config is stale (e.g. after a pipeline was deleted).
    const routedPipelineId = resolveLocationRoutingPipelineId(
      payload,
      endpoint.locationRouting as Record<string, string> | null,
    );
    const routedPipeline =
      routedPipelineId && routedPipelineId !== endpoint.pipelineId
        ? await prisma.pipeline.findFirst({
            where: { id: routedPipelineId, organizationId: endpoint.organizationId },
          })
        : null;
    const pipelineId = routedPipeline?.id ?? endpoint.pipelineId;
    const pipeline = routedPipeline ?? (await prisma.pipeline.findUnique({ where: { id: pipelineId } }));
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const firstStage = await prisma.stage.findFirst({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });
    if (!firstStage) {
      throw new Error("Pipeline has no stages configured");
    }

    const fields = extractContactFields(payload, endpoint.fieldMapping as Record<string, string> | null);

    // Call-tracking sources (matelso): a misdial or immediate hang-up isn't a
    // real lead - skip creating a Contact for calls under the configured
    // minimum duration, but still log the delivery so it stays visible.
    const callDurationSeconds = extractCallDurationSeconds(
      payload,
      endpoint.fieldMapping as Record<string, string> | null,
    );
    if (
      endpoint.minCallDurationSeconds !== null &&
      callDurationSeconds !== null &&
      callDurationSeconds < endpoint.minCallDurationSeconds
    ) {
      await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          rawPayload: payload,
          skippedReason: `Anruf zu kurz (${callDurationSeconds}s < ${endpoint.minCallDurationSeconds}s) - kein Lead angelegt.`,
        },
      });
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    // Anonymous call (Rufnummernunterdrückung): no phone AND no name at all -
    // still worth surfacing as a card so the client notices a call happened,
    // rather than silently dropping it because there's nothing to display.
    if (endpoint.source === "MATELSO" && !fields.firstName && !fields.lastName && !fields.phone) {
      fields.firstName = "Anonymer Anrufer";
    }

    const cvUrl = fields.cvUrl ? await mirrorExternalFile(fields.cvUrl) : null;
    const website = deriveWebsiteFromEmail(fields.email);

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
        pipelineId,
        stageId: firstStage.id,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        phone: fields.phone,
        location: fields.location,
        companyName: fields.companyName,
        website,
        address: fields.address,
        cvUrl,
        source: CONTACT_SOURCE_BY_WEBHOOK_SOURCE[endpoint.source],
        customFields: stripTrackingFields((customFields as Prisma.InputJsonObject | null) ?? payload),
      },
    });

    await prisma.webhookDelivery.create({
      data: { endpointId: endpoint.id, rawPayload: payload, contactId: contact.id },
    });

    // Best-effort: a notification/auto-reply failure must never fail lead
    // ingestion itself, which is the one thing this route may never lose.
    try {
      await handleNewContactCreated(pipeline, contact);
    } catch (notifyError) {
      console.error("[webhook] handleNewContactCreated failed:", notifyError);
    }

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
