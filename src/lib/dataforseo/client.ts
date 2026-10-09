/**
 * Minimaler DataForSEO-REST-Client - die bezahlte (aber nutzungsbasierte,
 * kein Abo nötig) Ergänzung zur kostenlosen Google-Search-Console-Analyse
 * (siehe seo-gaps.ts): echtes Google-Suchvolumen statt nur eigener GSC-
 * Impressionen, Konkurrenz-Keyword-Vergleich (wofür rankt die Konkurrenz,
 * wir aber nicht) und ein Backlink-Profil-Snapshot der eigenen Domain. Das
 * ist die "Daten einkaufen statt selbst crawlen"-Variante von Semrush/
 * Ahrefs-ähnlichen Auswertungen (siehe Diskussion in der Session).
 *
 * Setup (durch den Nutzer, nicht durch diese Session möglich): Account unter
 * app.dataforseo.com anlegen, Login (= Account-E-Mail) + API-Passwort (NICHT
 * das normale Account-Passwort, sondern ein separat generiertes API-Passwort
 * unter "API access") als DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD in Vercel
 * setzen. Ohne gesetzte Zugangsdaten: sauberes No-Op/Fehlermeldung, kein
 * Crash - analog zu close/client.ts.
 *
 * Jeder Aufruf kostet echtes Geld (Pay-as-you-go, siehe .env.example) - alle
 * Funktionen hier werden deshalb ausschließlich über manuelle "Jetzt"-Buttons
 * ausgelöst, nicht automatisch im Cron (siehe PlatformSettings.dataForSeoEnabled
 * und die ausdrückliche Nutzerentscheidung dazu in der Session).
 */
const DATAFORSEO_API_BASE = "https://api.dataforseo.com/v3";
const LOCATION_NAME = "Germany";
const LANGUAGE_CODE = "de";

export type DataForSeoResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function isDataForSeoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO ist nicht konfiguriert (DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD fehlen).");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

type DataForSeoTask<T> = {
  status_code: number;
  status_message: string;
  result: T[] | null;
};
type DataForSeoResponse<T> = {
  status_code: number;
  status_message: string;
  tasks: DataForSeoTask<T>[] | null;
};

/** POST gegen einen DataForSEO-"live"-Endpoint - ein Task pro Aufruf, wie bei allen hier genutzten Endpoints. */
async function postTask<TBody extends object, TResult>(path: string, body: TBody): Promise<TResult[]> {
  const res = await fetch(`${DATAFORSEO_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify([body]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DataForSEO-Anfrage fehlgeschlagen (${res.status})${text ? `: ${text.slice(0, 300)}` : ""}`);
  }
  const data = (await res.json()) as DataForSeoResponse<TResult>;
  if (data.status_code !== 20000) throw new Error(`DataForSEO: ${data.status_message}`);
  const task = data.tasks?.[0];
  if (!task) throw new Error("DataForSEO: keine Antwort für die Anfrage erhalten.");
  if (task.status_code !== 20000) throw new Error(`DataForSEO: ${task.status_message}`);
  return task.result ?? [];
}

// ---------------------------------------------------------------------------
// Echtes Suchvolumen (Keywords Data API) - ersetzt die reine KI-Schätzung bei
// der Ideen-Generierung bzw. reichert bestehende GSC-Content-Lücken an.
// ---------------------------------------------------------------------------

type RawSearchVolumeRow = { keyword: string; search_volume: number | null; cpc: number | null };

export type SearchVolumeInfo = { searchVolume: number | null; cpc: number | null };

/** Bis zu 1000 Keywords pro Aufruf (DataForSEO-Limit) - für unsere Mengen (Dutzende) reicht ein Batch. */
export async function getSearchVolumes(keywords: string[]): Promise<DataForSeoResult<Map<string, SearchVolumeInfo>>> {
  const unique = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 1000);
  if (unique.length === 0) return { ok: true, data: new Map() };

  try {
    const rows = await postTask<{ keywords: string[]; location_name: string; language_code: string }, RawSearchVolumeRow>(
      "/keywords_data/google_ads/search_volume/live",
      { keywords: unique, location_name: LOCATION_NAME, language_code: LANGUAGE_CODE },
    );
    const map = new Map<string, SearchVolumeInfo>();
    for (const row of rows) map.set(row.keyword, { searchVolume: row.search_volume, cpc: row.cpc });
    return { ok: true, data: map };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der DataForSEO-Suchvolumen-Abfrage." };
  }
}

// ---------------------------------------------------------------------------
// Backlink-Profil (Backlinks API) - Live-Snapshot der eigenen Zieldomain.
// ---------------------------------------------------------------------------

type RawBacklinkSummary = {
  rank: number | null;
  backlinks: number | null;
  referring_domains: number | null;
  referring_domains_nofollow: number | null;
  broken_backlinks: number | null;
  backlinks_spam_score: number | null;
};

export type BacklinkSummary = {
  rank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  referringDomainsNofollow: number | null;
  brokenBacklinks: number | null;
  spamScore: number | null;
};

export async function getBacklinkSummary(targetDomain: string): Promise<DataForSeoResult<BacklinkSummary>> {
  try {
    const rows = await postTask<{ target: string; backlinks_status_type: string }, RawBacklinkSummary>("/backlinks/summary/live", {
      target: targetDomain,
      backlinks_status_type: "live",
    });
    const row = rows[0];
    if (!row) return { ok: false, error: "DataForSEO hat kein Backlink-Profil für diese Domain geliefert." };
    return {
      ok: true,
      data: {
        rank: row.rank,
        backlinks: row.backlinks,
        referringDomains: row.referring_domains,
        referringDomainsNofollow: row.referring_domains_nofollow,
        brokenBacklinks: row.broken_backlinks,
        spamScore: row.backlinks_spam_score,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der DataForSEO-Backlink-Abfrage." };
  }
}

// ---------------------------------------------------------------------------
// Konkurrenz-Keyword-Gaps (DataForSEO Labs - Domain Intersection,
// intersections=false): Keywords, für die die Konkurrenz-Domain rankt, aber
// unsere Zieldomain nicht (oder schlechter) - die eigentliche "wofür werden
// wir im Vergleich zur Konkurrenz nicht gefunden"-Analyse.
// ---------------------------------------------------------------------------

type RawDomainIntersectionRow = {
  keyword_data: { keyword: string; keyword_info: { search_volume: number | null } };
  first_domain_serp_element: { rank_group: number } | null;
  second_domain_serp_element: { rank_group: number } | null;
};

export type CompetitorKeywordGapRow = {
  keyword: string;
  searchVolume: number | null;
  competitorPosition: number | null;
  ourPosition: number | null;
};

/** target1 = Konkurrenz, target2 = wir. intersections=false -> nur Keywords, für die target1 rankt und target2 nicht (oder beide, aber unterschiedlich). */
export async function getCompetitorKeywordGaps(
  competitorDomain: string,
  ourDomain: string,
  limit = 100,
): Promise<DataForSeoResult<CompetitorKeywordGapRow[]>> {
  try {
    const rows = await postTask<
      { target1: string; target2: string; location_name: string; language_code: string; intersections: boolean; limit: number },
      RawDomainIntersectionRow
    >("/dataforseo_labs/google/domain_intersection/live", {
      target1: competitorDomain,
      target2: ourDomain,
      location_name: LOCATION_NAME,
      language_code: LANGUAGE_CODE,
      intersections: false,
      limit,
    });
    const gaps: CompetitorKeywordGapRow[] = rows
      .filter((row) => row.first_domain_serp_element) // Konkurrenz muss ranken, sonst kein "Gap" aus ihrer Sicht
      .map((row) => ({
        keyword: row.keyword_data.keyword,
        searchVolume: row.keyword_data.keyword_info?.search_volume ?? null,
        competitorPosition: row.first_domain_serp_element?.rank_group ?? null,
        ourPosition: row.second_domain_serp_element?.rank_group ?? null,
      }));
    return { ok: true, data: gaps };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der DataForSEO-Konkurrenzanalyse." };
  }
}
