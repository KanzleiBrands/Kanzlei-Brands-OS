import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/auth-encryption";
import { verifyMetaSignature } from "@/lib/meta/verify-signature";
import { fetchMetaLead, MetaGraphError } from "@/lib/meta/graph";
import { extractContactFieldsFromMetaLead, stripTrackingFields } from "@/lib/webhook-ingest";
import { deriveWebsiteFromEmail } from "@/lib/company";
import { handleNewContactCreated } from "@/lib/notify-new-contact";

// One fixed App-level callback for every connected Page (Meta doesn't allow
// a per-Page/per-form callback URL like our own generic webhook system),
// authenticated via the shared verify token (GET) and HMAC signature (POST)
// instead of an unguessable URL token.
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type MetaLeadgenChangeValue = {
  leadgen_id: string;
  page_id: string;
  form_id: string;
  ad_id?: string;
  created_time?: number;
};
type MetaWebhookEntry = { id: string; time: number; changes: { field: string; value: MetaLeadgenChangeValue }[] };
type MetaWebhookBody = { object: string; entry?: MetaWebhookEntry[] };

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leadgenValues = (body.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).filter((change) => change.field === "leadgen").map((change) => change.value),
  );

  for (const value of leadgenValues) {
    await processLeadgenEvent(value).catch((error) => {
      console.error("[meta-webhook] Failed to process leadgen event:", error);
    });
  }

  // Meta only needs a fast 200 to consider delivery successful; per-lead
  // failures are logged against the connection instead of failing the
  // whole batch, so one bad lead doesn't make Meta retry-storm the others.
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processLeadgenEvent(value: MetaLeadgenChangeValue) {
  const connection = await prisma.metaLeadFormConnection.findFirst({
    where: { formId: value.form_id, pageId: value.page_id, active: true },
  });
  if (!connection) return; // Not (or no longer) a form we're connected to.

  const alreadyDelivered = await prisma.metaLeadDelivery.findUnique({
    where: { connectionId_leadgenId: { connectionId: connection.id, leadgenId: value.leadgen_id } },
  });
  if (alreadyDelivered) return; // Meta redelivered an event we already processed.

  const pipeline = await prisma.pipeline.findUnique({ where: { id: connection.pipelineId } });
  if (!pipeline) return;
  const firstStage = await prisma.stage.findFirst({ where: { pipelineId: pipeline.id }, orderBy: { order: "asc" } });
  if (!firstStage) return;

  try {
    const pageAccessToken = decryptToken(connection.pageAccessTokenEnc);
    const lead = await fetchMetaLead(value.leadgen_id, pageAccessToken);
    const fields = extractContactFieldsFromMetaLead(lead.field_data);

    const contact = await prisma.contact.create({
      data: {
        pipelineId: pipeline.id,
        stageId: firstStage.id,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        phone: fields.phone,
        location: fields.location,
        companyName: fields.companyName,
        address: fields.address,
        website: deriveWebsiteFromEmail(fields.email),
        source: "META_LEAD_ADS",
        customFields: stripTrackingFields(fields.customFields as Prisma.InputJsonObject),
      },
    });

    await prisma.metaLeadDelivery.create({
      data: {
        connectionId: connection.id,
        leadgenId: value.leadgen_id,
        contactId: contact.id,
        rawPayload: lead as unknown as Prisma.InputJsonObject,
      },
    });

    try {
      await handleNewContactCreated(pipeline, contact);
    } catch (notifyError) {
      console.error("[meta-webhook] handleNewContactCreated failed:", notifyError);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Graph error 190 = expired/invalid access token (password change,
    // access revoked in Facebook, ...) - flag the connection for
    // reconnection instead of failing silently forever.
    if (error instanceof MetaGraphError && error.graphErrorCode === 190) {
      await prisma.metaLeadFormConnection.update({
        where: { id: connection.id },
        data: { active: false, lastError: "Zugriff abgelaufen - bitte erneut mit Facebook verbinden." },
      });
    }
    await prisma.metaLeadDelivery.create({
      data: { connectionId: connection.id, leadgenId: value.leadgen_id, error: message },
    });
  }
}
