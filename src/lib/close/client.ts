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

// ---------------------------------------------------------------------------
// Cashflow-/Sales-Cockpit: Live-Auswertungen direkt aus Close.io, nichts wird
// bei uns gespiegelt/gespeichert. Nutzt Close.ios klassische List-Endpoints
// mit Django-Style-Filtersuffixen (__gte/__lte) und _skip/_limit-Pagination -
// Feldnamen sind nach Close.io-API-Dokumentationsstand, aber ohne echten
// CLOSE_API_KEY in dieser Sandbox nicht gegen die echte API testbar. Bei
// Abweichungen (z.B. andere Feldnamen) hier zuerst nachjustieren.
// ---------------------------------------------------------------------------

export type CloseResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

async function closeFetchAll<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T[]> {
  const results: T[] = [];
  const limit = 100;
  let skip = 0;
  for (;;) {
    const url = new URL(`${CLOSE_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("_limit", String(limit));
    url.searchParams.set("_skip", String(skip));
    const res = await fetch(url.toString(), { headers: { Authorization: closeAuthHeader(apiKey) } });
    if (!res.ok) throw new Error(`Close.io-Abfrage fehlgeschlagen (${res.status}) - ${path}`);
    const data = (await res.json()) as { data: T[]; has_more: boolean };
    results.push(...data.data);
    if (!data.has_more || data.data.length === 0) break;
    skip += limit;
  }
  return results;
}

type CloseOpportunity = {
  id: string;
  value: number | null; // Close speichert Beträge in Cent
  date_won: string | null;
  user_id: string;
  user_name: string | null;
};

export type MonthlyDealVolume = { month: number; userId: string; userName: string; valueNet: number };

/** Gewonnene Opportunities eines Jahres, je Close-User und Monat aufsummiert (Wert in €, netto laut Close-Eintrag). */
export async function listWonOpportunitiesByMonth(year: number): Promise<CloseResult<MonthlyDealVolume>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const opportunities = await closeFetchAll<CloseOpportunity>(
      "/opportunity/",
      { status_type: "won", date_won__gte: `${year}-01-01`, date_won__lte: `${year}-12-31` },
      apiKey,
    );

    const byKey = new Map<string, MonthlyDealVolume>();
    for (const opp of opportunities) {
      if (!opp.date_won || opp.value == null) continue;
      const month = new Date(opp.date_won).getMonth() + 1;
      const key = `${opp.user_id}:${month}`;
      const valueNet = opp.value / 100;
      const existing = byKey.get(key);
      if (existing) existing.valueNet += valueNet;
      else byKey.set(key, { month, userId: opp.user_id, userName: opp.user_name ?? "Unbekannt", valueNet });
    }
    return { ok: true, rows: Array.from(byKey.values()) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}

type CloseCallActivity = {
  id: string;
  direction: string;
  user_id: string;
  user_name: string | null;
  date_created: string;
};

export type MonthlyCallCount = { month: number; userId: string; userName: string; callCount: number };

/** Ausgehende Telefonate eines Jahres, je Close-User und Monat gezählt. */
export async function listOutboundCallsByMonth(year: number): Promise<CloseResult<MonthlyCallCount>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const calls = await closeFetchAll<CloseCallActivity>(
      "/activity/call/",
      { direction: "outbound", date_created__gte: `${year}-01-01T00:00:00`, date_created__lte: `${year}-12-31T23:59:59` },
      apiKey,
    );

    const byKey = new Map<string, MonthlyCallCount>();
    for (const call of calls) {
      const month = new Date(call.date_created).getMonth() + 1;
      const key = `${call.user_id}:${month}`;
      const existing = byKey.get(key);
      if (existing) existing.callCount += 1;
      else byKey.set(key, { month, userId: call.user_id, userName: call.user_name ?? "Unbekannt", callCount: 1 });
    }
    return { ok: true, rows: Array.from(byKey.values()) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}
