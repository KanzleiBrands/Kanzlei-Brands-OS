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
// mit Django-Style-Filtersuffixen (__gte/__lte) und _skip/_limit-Pagination.
// Gegen einen echten Account geprüft: /activity/call/ liefert user_id, aber
// KEIN user_name - Namen kommen deshalb separat über resolveCloseUserNames()
// (GET /me/ -> GET /organization/{id}/, dieselben Felder wie die
// Mitgliederliste). Bei Opportunities bleibt date_won als Filter/Feldname
// unverifiziert (die verfügbare Prüfung zeigte nur den abgeleiteten
// close_at-Wert) - bei Abweichungen hier zuerst nachjustieren.
// ---------------------------------------------------------------------------

export type CloseResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

let cachedUserNames: Promise<Map<string, string>> | null = null;

/** Löst Close-User-IDs zu "Vorname Nachname" auf - gecacht pro Server-Instanz, da sich Org-Mitglieder selten ändern. */
async function resolveCloseUserNames(apiKey: string): Promise<Map<string, string>> {
  if (!cachedUserNames) {
    cachedUserNames = (async () => {
      const meRes = await fetch(`${CLOSE_API_BASE}/me/`, { headers: { Authorization: closeAuthHeader(apiKey) } });
      if (!meRes.ok) throw new Error(`Close.io-Nutzerabfrage fehlgeschlagen (${meRes.status})`);
      const me = (await meRes.json()) as { organizations?: { id: string }[] };
      const orgId = me.organizations?.[0]?.id;
      if (!orgId) return new Map<string, string>();

      const orgRes = await fetch(`${CLOSE_API_BASE}/organization/${orgId}/`, { headers: { Authorization: closeAuthHeader(apiKey) } });
      if (!orgRes.ok) throw new Error(`Close.io-Organisationsabfrage fehlgeschlagen (${orgRes.status})`);
      const org = (await orgRes.json()) as { memberships?: { user_id: string; user_first_name: string; user_last_name: string }[] };

      const names = new Map<string, string>();
      for (const membership of org.memberships ?? []) {
        names.set(membership.user_id, `${membership.user_first_name} ${membership.user_last_name}`.trim());
      }
      return names;
    })().catch((error) => {
      cachedUserNames = null;
      throw error;
    });
  }
  return cachedUserNames;
}

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

// ---------------------------------------------------------------------------
// Sales Cockpit: Opener/Setter/Closer - komplett aus Close Custom Activities
// abgeleitet, kein manuelles End-of-Day mehr. Activity-Type-IDs gegen den
// echten Account geprüft (mcp__Close__find_custom_activities):
//   1.0 Outbound Call         -> Opener
//   1.2 Quali / Erstgespräch  -> Setter
//   1.3 Sales Call            -> Closer
//   2.3 After Sales Formular  -> Abschlüsse (Opener+Setter+Closer je Deal)
// Raw-REST-Shape von /activity/{custom_activity_type_id}/ gegen echte Daten
// verifiziert: Objekte tragen user_id (wer die Aktivität geloggt hat) und ein
// custom_fields-Array aus {id, name, value} - anders als bei den fest
// eingebauten Activity-Typen wird "value" hier per Feldname statt Feld-ID
// gelesen (siehe fieldValue).
// ---------------------------------------------------------------------------

const ACTIVITY_TYPE_OUTBOUND_CALL = "actitype_5nA75KbOpKFg3iTt4cRGI7"; // 1.0 Outbound Call
const ACTIVITY_TYPE_QUALI_CALL = "actitype_7OKkLYA2kNte8rlsMn5eCj"; // 1.2 Quali / Erstgespräch
const ACTIVITY_TYPE_SALES_CALL = "actitype_72gloM4XFzyVoFAaRRB8hb"; // 1.3 Sales Call
const ACTIVITY_TYPE_AFTER_SALES = "actitype_7lvHog63HgPrkPsKH9W2nY"; // 2.3 After Sales Formular

type CloseCustomField = { id: string; name: string; value: string | null };
type CloseCustomActivityInstance = { id: string; user_id: string; activity_at: string; custom_fields: CloseCustomField[] };

function fieldValue(fields: CloseCustomField[], name: string): string | null {
  return fields.find((f) => f.name === name)?.value ?? null;
}

async function listCustomActivitiesForYear(
  activityTypeId: string,
  year: number,
  apiKey: string,
): Promise<CloseCustomActivityInstance[]> {
  return closeFetchAll<CloseCustomActivityInstance>(
    `/activity/${activityTypeId}/`,
    { activity_at__gte: `${year}-01-01T00:00:00`, activity_at__lte: `${year}-12-31T23:59:59` },
    apiKey,
  );
}

export type OpenerStats = {
  userId: string;
  userName: string;
  calls: number;
  reached: number;
  decisionMakerReached: number;
  appointmentsSet: number;
};

/** Opener-Kennzahlen aus "1.0 Outbound Call" - je Close-User über das ganze Jahr aufsummiert. */
export async function listOpenerStats(year: number): Promise<CloseResult<OpenerStats>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const [instances, userNames] = await Promise.all([
      listCustomActivitiesForYear(ACTIVITY_TYPE_OUTBOUND_CALL, year, apiKey),
      resolveCloseUserNames(apiKey),
    ]);

    const byUser = new Map<string, OpenerStats>();
    for (const inst of instances) {
      const stats = byUser.get(inst.user_id) ?? {
        userId: inst.user_id,
        userName: userNames.get(inst.user_id) ?? "Unbekannt",
        calls: 0,
        reached: 0,
        decisionMakerReached: 0,
        appointmentsSet: 0,
      };
      stats.calls += 1;
      if (fieldValue(inst.custom_fields, "Erreicht") === "Ja") stats.reached += 1;
      if (fieldValue(inst.custom_fields, "Mit Entscheider gesprochen?") === "Ja") stats.decisionMakerReached += 1;
      if (fieldValue(inst.custom_fields, "Termin gesetzt?") === "Ja") stats.appointmentsSet += 1;
      byUser.set(inst.user_id, stats);
    }
    return { ok: true, rows: Array.from(byUser.values()) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}

export type SetterStats = {
  userId: string;
  userName: string;
  qualiCalls: number;
  shown: number;
  qualified: number;
  consultationOffered: number;
};

/** Setter-Kennzahlen aus "1.2 Quali / Erstgespräch". */
export async function listSetterStats(year: number): Promise<CloseResult<SetterStats>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const [instances, userNames] = await Promise.all([
      listCustomActivitiesForYear(ACTIVITY_TYPE_QUALI_CALL, year, apiKey),
      resolveCloseUserNames(apiKey),
    ]);

    const byUser = new Map<string, SetterStats>();
    for (const inst of instances) {
      const stats = byUser.get(inst.user_id) ?? {
        userId: inst.user_id,
        userName: userNames.get(inst.user_id) ?? "Unbekannt",
        qualiCalls: 0,
        shown: 0,
        qualified: 0,
        consultationOffered: 0,
      };
      stats.qualiCalls += 1;
      if (fieldValue(inst.custom_fields, "Erschienen") === "Ja") stats.shown += 1;
      if (fieldValue(inst.custom_fields, "Lead qualifiziert?") === "Ja") stats.qualified += 1;
      if (fieldValue(inst.custom_fields, "Beratungstermin angeboten") === "Ja") stats.consultationOffered += 1;
      byUser.set(inst.user_id, stats);
    }
    return { ok: true, rows: Array.from(byUser.values()) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}

export type CloserStats = {
  userId: string;
  userName: string;
  salesCalls: number;
  shown: number;
  offersMade: number;
};

/** Closer-Kennzahlen aus "1.3 Sales Call". */
export async function listCloserStats(year: number): Promise<CloseResult<CloserStats>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const [instances, userNames] = await Promise.all([
      listCustomActivitiesForYear(ACTIVITY_TYPE_SALES_CALL, year, apiKey),
      resolveCloseUserNames(apiKey),
    ]);

    const byUser = new Map<string, CloserStats>();
    for (const inst of instances) {
      const stats = byUser.get(inst.user_id) ?? {
        userId: inst.user_id,
        userName: userNames.get(inst.user_id) ?? "Unbekannt",
        salesCalls: 0,
        shown: 0,
        offersMade: 0,
      };
      stats.salesCalls += 1;
      if (fieldValue(inst.custom_fields, "Erschienen?") === "Ja") stats.shown += 1;
      if (fieldValue(inst.custom_fields, "Angebot gemacht?") === "Ja") stats.offersMade += 1;
      byUser.set(inst.user_id, stats);
    }
    return { ok: true, rows: Array.from(byUser.values()) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}

export type ClosedDeal = { openerUserId: string | null; setterUserId: string | null; closerUserId: string | null; amountNet: number };

/** Abschlüsse eines Jahres aus "2.3 After Sales Formular" - trägt Opener/Setter/Closer als eigene Felder. */
export async function listClosedDeals(year: number): Promise<CloseResult<ClosedDeal>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const instances = await listCustomActivitiesForYear(ACTIVITY_TYPE_AFTER_SALES, year, apiKey);
    const rows: ClosedDeal[] = instances.map((inst) => ({
      openerUserId: fieldValue(inst.custom_fields, "Opener"),
      setterUserId: fieldValue(inst.custom_fields, "Setter"),
      closerUserId: fieldValue(inst.custom_fields, "Closer"),
      amountNet: Number(fieldValue(inst.custom_fields, "Abgeschlossene Summe (Netto)") ?? 0) || 0,
    }));
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}
