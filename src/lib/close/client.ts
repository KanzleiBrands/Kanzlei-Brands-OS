import { prisma } from "@/lib/prisma";

/**
 * Minimaler Close.io-REST-Client, nur für das eine Sync-Bedürfnis hier: eine
 * versendete Marketing-Funnel-Mail als Notiz am passenden Lead protokollieren,
 * damit der Vertrieb in Close sieht, dass/was der Kontakt aus der E-Mail-Liste
 * bekommen hat. Setup (durch den Nutzer, nicht durch diese Session möglich):
 * einen API Key unter close.com > Settings > API Keys erzeugen und als
 * CLOSE_API_KEY in Vercel setzen. Ohne gesetzten Key: sauberes No-Op, kein
 * Crash - der Funnel-Versand selbst darf davon nie abhängen.
 *
 * Bewusst eine einfache Notiz statt einer "Email"-Activity: Close.ios
 * Email-Activity-Endpoint verlangt ein volles Envelope-Objekt (from/to/
 * sender_account_id/...), dessen exaktes Pflichtfeld-Set sich ohne echten
 * API-Zugriff nicht verlässlich verifizieren lässt - eine Notiz ist stabil
 * dokumentiert und braucht nur lead_id + Text.
 */
const CLOSE_API_BASE = "https://api.close.com/api/v1";

function closeAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function findCloseLeadIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const url = `${CLOSE_API_BASE}/lead/?query=${encodeURIComponent(`email:"${email}"`)}`;
  const res = await fetch(url, { headers: { Authorization: closeAuthHeader(apiKey) } });
  if (!res.ok) throw new Error(`Close.io-Suche fehlgeschlagen (${res.status})`);
  const data = (await res.json()) as { data?: { id: string }[] };
  return data.data?.[0]?.id ?? null;
}

async function createCloseNote(leadId: string, note: string, apiKey: string): Promise<void> {
  const res = await fetch(`${CLOSE_API_BASE}/activity/note/`, {
    method: "POST",
    headers: { Authorization: closeAuthHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId, note }),
  });
  if (!res.ok) throw new Error(`Close.io-Notiz fehlgeschlagen (${res.status}): ${await res.text()}`);
}

/**
 * Sucht (einmalig, danach über subscriber.closeLeadId gecacht) den zum
 * Subscriber passenden Close-Lead per E-Mail und protokolliert die gesendete
 * Funnel-Mail dort als Notiz. Best-effort: jeder Fehler wird geloggt statt
 * geworfen, damit der Cron-Versand selbst niemals daran scheitert.
 */
export async function syncFunnelSendToClose(subscriberId: string, subject: string): Promise<void> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return;

  try {
    const subscriber = await prisma.marketingSubscriber.findUnique({ where: { id: subscriberId } });
    if (!subscriber) return;

    let leadId = subscriber.closeLeadId;
    if (!leadId) {
      leadId = await findCloseLeadIdByEmail(subscriber.email, apiKey);
      if (!leadId) return; // kein passender Lead in Close - nichts zu synchronisieren
      await prisma.marketingSubscriber.update({ where: { id: subscriberId }, data: { closeLeadId: leadId } });
    }

    await createCloseNote(leadId, `Marketing-E-Mail gesendet: "${subject}"`, apiKey);
  } catch (error) {
    console.error("[close] syncFunnelSendToClose failed", error);
  }
}
