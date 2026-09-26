import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractContactFields } from "@/lib/webhook-ingest";
import { applyTag } from "@/lib/actions/marketing-list";

/**
 * Ein Webhook pro Tag (siehe MarketingListWebhook) - ein externes Landing-
 * page-/Formular-Tool ruft diese URL beim Absenden auf. Legt den Subscriber
 * an oder aktualisiert ihn (upsert per organizationId+email), hängt den zum
 * Token gehörenden Tag an und löst dadurch jeden verknüpften Funnel aus -
 * bewusst kein Double-Opt-in, direkt aktiv (siehe applyTag).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const webhook = await prisma.marketingListWebhook.findUnique({ where: { token } });
  if (!webhook) {
    return NextResponse.json({ error: "Unknown webhook" }, { status: 404 });
  }

  let payload: Prisma.InputJsonObject;
  try {
    payload = (await request.json()) as Prisma.InputJsonObject;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields = extractContactFields(payload as Record<string, unknown>);
  const email = fields.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Missing or invalid email" }, { status: 400 });
  }

  const subscriber = await prisma.marketingSubscriber.upsert({
    where: { organizationId_email: { organizationId: webhook.organizationId, email } },
    create: {
      organizationId: webhook.organizationId,
      email,
      firstName: fields.firstName,
      lastName: fields.lastName,
      phone: fields.phone,
    },
    update: {
      firstName: fields.firstName ?? undefined,
      lastName: fields.lastName ?? undefined,
      phone: fields.phone ?? undefined,
    },
  });

  await applyTag(subscriber.id, webhook.tagId);

  return NextResponse.json({ ok: true, subscriberId: subscriber.id }, { status: 201 });
}
