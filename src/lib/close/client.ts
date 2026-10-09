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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Close.io-Abfrage fehlgeschlagen (${res.status}) - ${path}${body ? `: ${body.slice(0, 300)}` : ""}`);
    }
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
// Custom Activities liegen NICHT unter /activity/{custom_activity_type_id}/
// (das gibt es bei Close nicht, führt zu 404) - Instanzen eines Custom-
// Activity-Typs werden über den generischen /activity/custom/-Endpoint mit
// custom_activity_type_id als Query-Parameter gelistet. Raw-REST-Shape gegen
// echte Daten verifiziert: Objekte tragen user_id (wer die Aktivität geloggt
// hat) und ein custom_fields-Array aus {id, name, value} - anders als bei
// den fest eingebauten Activity-Typen wird "value" hier per Feldname statt
// Feld-ID gelesen (siehe fieldValue).
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
  // Zeitzone explizit angeben (Z) - ein Datetime-String ohne Zeitzonen-Suffix
  // ist kein gültiges ISO-8601 und wird von Close ggf. als ungültiger
  // Filterwert abgelehnt (400), anders als beim vorherigen 404 (da schlug die
  // Anfrage schon am falschen Pfad fehl, bevor Parameter geprüft wurden).
  return closeFetchAll<CloseCustomActivityInstance>(
    `/activity/custom/`,
    {
      custom_activity_type_id: activityTypeId,
      activity_at__gte: `${year}-01-01T00:00:00Z`,
      activity_at__lte: `${year}-12-31T23:59:59Z`,
    },
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

// ---------------------------------------------------------------------------
// Attribution/Kampagnen-Reiter: Leads + Opportunities für den Candidate-
// Journey-Sync (siehe src/lib/attribution/close-sync.ts). Anders als die
// Custom-Activity-Instanzen oben tragen Lead-Objekte ihre custom_fields
// direkt im selben {id,name,value}-Array-Format (gegen einen echten Lead
// via mcp__Close__fetch_lead verifiziert) - fieldValue() ist wiederverwendbar.
// ---------------------------------------------------------------------------

export type CloseLeadContact = { id: string; name: string; emails?: { email: string; type?: string }[] };
export type CloseLead = {
  id: string;
  name: string;
  created_at: string;
  contacts: CloseLeadContact[];
  custom_fields: CloseCustomField[];
};

/** Alle Leads der Organisation - ohne query-Filter listet /lead/ den gesamten Bestand paginiert auf. */
export async function listCloseLeadsForAttribution(): Promise<CloseResult<CloseLead>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };
  try {
    const rows = await closeFetchAll<CloseLead>("/lead/", {}, apiKey);
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}

export type CloseOpportunity = {
  id: string;
  lead_id: string;
  status_type: "active" | "won" | "lost";
  value: number | null; // in Cent
  date_won: string | null;
  updated_at: string;
};

/** Alle Opportunities (Deals) - status_type=won trägt den echten Abschluss samt Wert/Datum. */
export async function listCloseOpportunities(): Promise<CloseResult<CloseOpportunity>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };
  try {
    const rows = await closeFetchAll<CloseOpportunity>("/opportunity/", {}, apiKey);
    return { ok: true, rows };
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

/**
 * Call-Transkripte (Cold Calls, Quali-Calls etc.) für die KI-Ideen-
 * Generierung im internen Marketing-Center (siehe src/lib/actions/
 * close-calls.ts) - Einwände/Glaubenssätze aus echten Gesprächen als
 * Content-Rohmaterial. Zweistufig wie der Fireflies-Client: erst eine
 * günstige Liste von Kandidaten (Metadaten only), dann pro neuem Call gezielt
 * der volle Transkripttext - vermeidet, bei einem großen Backfill die
 * teureren Transkript-Felder für Calls zu laden, die ohnehin schon
 * gespeichert sind.
 *
 * WICHTIG: volle Gesprächstranskripte (recording_transcript) liefert Close
 * nur, wenn der Close-Plan die "Call Assistant"-Funktion aktiviert hat (ab
 * 30 Sekunden Gesprächsdauer). Voicemail-Transkripte (voicemail_transcript)
 * liefert Close dagegen immer kostenlos. Ohne Call Assistant bleiben
 * beantwortete Calls also ggf. ohne Transkript - kein Fehler, nur weniger
 * Material, bis Call Assistant bei Close dazugebucht wird.
 */
export type CloseCallCandidate = {
  externalId: string;
  title: string;
  dateTime: Date;
  durationMinutes: number | null;
  organizerEmail: string | null;
  participants: string[];
  isVoicemail: boolean;
  /** Für den nachfolgenden getCloseCallTranscript-Aufruf (Sprecher-Zuordnung in den Utterances). */
  leadName: string;
  userName: string | null;
};

type RawCloseCall = {
  id: string;
  lead_id: string;
  user_id: string;
  user_name: string | null;
  date_created: string;
  duration: number | null; // Sekunden
  status: string;
  disposition: string | null;
};

const CLOSE_CALL_LIST_FIELDS = "id,lead_id,user_id,user_name,date_created,duration,status,disposition";

async function fetchLeadDisplayNames(leadIds: string[], apiKey: string): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(leadIds));
  const names = new Map<string, string>();
  const chunkSize = 25;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const url = new URL(`${CLOSE_API_BASE}/lead/`);
    url.searchParams.set("id__in", chunk.join(","));
    url.searchParams.set("_fields", "id,display_name");
    url.searchParams.set("_limit", String(chunkSize));
    const res = await fetch(url.toString(), { headers: { Authorization: closeAuthHeader(apiKey) } });
    if (!res.ok) throw new Error(`Close.io-Lead-Abfrage fehlgeschlagen (${res.status})`);
    const data = (await res.json()) as { data: { id: string; display_name: string }[] };
    for (const lead of data.data) names.set(lead.id, lead.display_name);
  }
  return names;
}

/** Liste der Calls mit tatsächlichem Gesprächsinhalt (beantwortet, >=30s) oder Voicemail seit `fromDate` - noch ohne Transkripttext. */
export async function listCloseCallCandidates(fromDate: Date): Promise<CloseResult<CloseCallCandidate>> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const calls = await closeFetchAll<RawCloseCall>(
      "/activity/call/",
      { date_created__gte: fromDate.toISOString(), _fields: CLOSE_CALL_LIST_FIELDS },
      apiKey,
    );
    const relevant = calls.filter(
      (c) => (c.disposition === "answered" && (c.duration ?? 0) >= 30) || c.disposition === "vm-answer" || c.disposition === "vm-left",
    );
    const leadNames = await fetchLeadDisplayNames(relevant.map((c) => c.lead_id), apiKey);

    const rows: CloseCallCandidate[] = relevant.map((call) => {
      const isVoicemail = call.disposition !== "answered";
      const leadName = leadNames.get(call.lead_id) ?? "Unbekannter Kontakt";
      return {
        externalId: call.id,
        title: `${isVoicemail ? "Voicemail" : "Call"} mit ${leadName}`,
        dateTime: new Date(call.date_created),
        durationMinutes: call.duration != null ? call.duration / 60 : null,
        organizerEmail: null,
        participants: [leadName, call.user_name].filter((v): v is string => Boolean(v)),
        isVoicemail,
        leadName,
        userName: call.user_name,
      };
    });
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}

type CloseCallUtterance = { speaker_label: string | null; speaker_side: "contact" | "close-user"; text: string };
type CloseCallTranscriptField = { utterances: CloseCallUtterance[]; summary_text: string | null } | null;

/** Voller Transkripttext + Summary für genau einen Call - erst beim ersten Sync eines neuen Calls geladen (siehe close-calls.ts). */
export async function getCloseCallTranscript(
  externalId: string,
  leadName: string,
  userName: string | null,
): Promise<{ ok: true; summaryOverview: string | null; transcriptText: string | null } | { ok: false; error: string }> {
  const apiKey = process.env.CLOSE_API_KEY;
  if (!apiKey) return { ok: false, error: "CLOSE_API_KEY ist nicht konfiguriert." };

  try {
    const url = new URL(`${CLOSE_API_BASE}/activity/call/`);
    url.searchParams.set("id__in", externalId);
    url.searchParams.set("_fields", "id,recording_transcript,voicemail_transcript");
    const res = await fetch(url.toString(), { headers: { Authorization: closeAuthHeader(apiKey) } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Close.io-Transkript-Abfrage fehlgeschlagen (${res.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
    }
    const data = (await res.json()) as {
      data: { id: string; recording_transcript: CloseCallTranscriptField; voicemail_transcript: CloseCallTranscriptField }[];
    };
    const call = data.data[0];
    const transcript = call?.recording_transcript ?? call?.voicemail_transcript ?? null;
    if (!transcript || transcript.utterances.length === 0) return { ok: true, summaryOverview: null, transcriptText: null };

    const transcriptText = transcript.utterances
      .map((u) => `${u.speaker_side === "contact" ? leadName : (userName ?? "Close-Nutzer")}: ${u.text}`)
      .join("\n");
    return { ok: true, summaryOverview: transcript.summary_text, transcriptText };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Close.io-Abfrage." };
  }
}
