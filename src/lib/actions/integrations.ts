"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor, AccessDeniedError } from "@/lib/access";
import { getBaseUrl } from "@/lib/base-url";
import { ensureCalendlyWebhookSubscription, type EnsureWebhookResult } from "@/lib/calendly/client";

/**
 * Richtet das Calendly-Organization-Webhook-Abo automatisch ein (statt es
 * manuell im Calendly-UI anzulegen) - braucht CALENDLY_API_TOKEN (Personal
 * Access Token mit webhooks:read/write). Läuft bewusst im App-Server
 * (Vercel), nicht in einer externen Sandbox, da der Token dafür server-
 * seitig als Env-Var vorliegen muss. Gibt bei Neu-Anlage den Signing-Key
 * einmalig zurück - der muss danach als CALENDLY_WEBHOOK_SIGNING_KEY in
 * Vercel gesetzt werden, sonst kann /api/webhooks/calendly eingehende
 * Events nicht verifizieren.
 */
export async function setupCalendlyWebhook(): Promise<EnsureWebhookResult> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") {
    throw new AccessDeniedError("Nur die Geschäftsführung kann Integrationen einrichten.");
  }
  const apiToken = process.env.CALENDLY_API_TOKEN;
  if (!apiToken) return { ok: false, error: "CALENDLY_API_TOKEN ist nicht gesetzt." };

  const baseUrl = await getBaseUrl();
  return ensureCalendlyWebhookSubscription(apiToken, `${baseUrl}/api/webhooks/calendly`);
}

/**
 * Legt (idempotent) einen Tag + Webhook fürs interne E-Mail-Marketing an,
 * für Formular-/Landingpage-Tools, deren Kontakte direkt in die
 * E-Mail-Marketing-Liste (MarketingSubscriber) einlaufen sollen - z.B.
 * Perspective, Onepage. Wiederverwendet dieselbe Tag-Webhook-Mechanik wie
 * das bestehende E-Mail-Marketing (src/lib/actions/marketing-list.ts),
 * nur unter einem sprechenden Namen im neuen Integrationen-Reiter.
 */
export async function ensureLeadSourceWebhook(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!organizationId || !label) throw new Error("Organisation/Label fehlt.");

  const session = await requireSession();
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    throw new AccessDeniedError("Nur Agentur-Admins oder Marketing-Mitarbeiter können Integrationen verwalten.");
  }

  const tag = await prisma.marketingTag.upsert({
    where: { organizationId_name: { organizationId, name: label } },
    create: { organizationId, name: label, color: "blue" },
    update: {},
  });

  const existing = await prisma.marketingListWebhook.findFirst({ where: { tagId: tag.id } });
  if (!existing) {
    await prisma.marketingListWebhook.create({ data: { organizationId, tagId: tag.id } });
  }

  revalidatePath("/dashboard/intern/marketing/integrations");
}
