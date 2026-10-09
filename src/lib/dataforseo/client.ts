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

// DataForSEO lehnt den GESAMTEN Batch ab, wenn auch nur ein einziges Keyword
// diese Grenzen überschreitet (siehe docs.dataforseo.com/v3/keywords_data/
// google_ads/search_volume/live) - echte GSC-Suchanfragen sind zunehmend
// ganze Sätze/Fragen statt kurzer Stichworte (Leute tippen mittlerweile
// Fragen statt Keywords bei Google ein), die diese Grenze reißen. Solche
// Anfragen werden hier übersprungen statt den ganzen Lauf scheitern zu lassen.
const MAX_KEYWORD_CHARS = 80;
const MAX_KEYWORD_WORDS = 10;

function isValidDataForSeoKeyword(keyword: string): boolean {
  return keyword.length <= MAX_KEYWORD_CHARS && keyword.trim().split(/\s+/).length <= MAX_KEYWORD_WORDS;
}

/** Bis zu 1000 Keywords pro Aufruf (DataForSEO-Limit) - für unsere Mengen (Dutzende) reicht ein Batch. */
export async function getSearchVolumes(keywords: string[]): Promise<DataForSeoResult<Map<string, SearchVolumeInfo>>> {
  const unique = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean)))
    .filter(isValidDataForSeoKeyword)
    .slice(0, 1000);
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

// ---------------------------------------------------------------------------
// GEO-Sichtbarkeit (AI Optimization API - "LLM Responses"): schickt einen
// Prompt direkt an ChatGPT/Claude/Gemini/Perplexity (mit Websuche) und prüft,
// ob unsere Marke in der Antwort genannt bzw. unsere Domain als Quelle
// zitiert wird - das ist die eigentliche GEO-Messung (siehe Diskussion in der
// Session: SEO macht Inhalte zitierfähig, das hier misst, ob tatsächlich
// zitiert wird). Jeder Call fragt ein echtes KI-Modell ab und kostet
// entsprechend mehr als die reinen SEO-Endpoints oben - siehe .env.example
// und PlatformSettings.dataForSeoEnabled (gleiches "nur manuell"-Prinzip).
// ---------------------------------------------------------------------------

export type GeoProvider = "CHATGPT" | "CLAUDE" | "GEMINI" | "PERPLEXITY";

type GeoProviderConfig = {
  path: string;
  modelName: string;
  webSearchToggle: boolean; // Perplexity hat keinen Schalter - Websuche ist bei Sonar-Modellen standardmäßig an
  forceWebSearch: boolean;
  countryCode: boolean; // Gemini kennt laut Doku keinen Ländercode-Parameter
};

// Modellnamen sind Basis-Namen, die DataForSEO auf die jeweils neueste Version auflöst (siehe
// docs.dataforseo.com/v3/ai_optimization/.../models/) - bewusst die günstigeren/schnelleren
// Varianten statt der teuersten Reasoning-Modelle, da es hier nur um eine Ja/Nein-Sichtbarkeits-
// prüfung geht, nicht um Antwortqualität.
const GEO_PROVIDER_CONFIG: Record<GeoProvider, GeoProviderConfig> = {
  CHATGPT: { path: "/ai_optimization/chat_gpt/llm_responses/live", modelName: "gpt-4.1-mini", webSearchToggle: true, forceWebSearch: true, countryCode: true },
  CLAUDE: { path: "/ai_optimization/claude/llm_responses/live", modelName: "claude-haiku-4-5", webSearchToggle: true, forceWebSearch: true, countryCode: true },
  GEMINI: { path: "/ai_optimization/gemini/llm_responses/live", modelName: "gemini-2.5-flash", webSearchToggle: true, forceWebSearch: false, countryCode: false },
  PERPLEXITY: { path: "/ai_optimization/perplexity/llm_responses/live", modelName: "sonar", webSearchToggle: false, forceWebSearch: false, countryCode: true },
};

type RawGeoAnnotation = { title: string | null; url: string | null; direct_url?: string | null };
type RawGeoSection = { type: string; text: string | null; annotations: RawGeoAnnotation[] | null };
type RawGeoItem = { type: string; sections?: RawGeoSection[] };
type RawGeoResult = { model_name: string; web_search: boolean; items: RawGeoItem[] | null };

export type GeoVisibilityResult = {
  mentioned: boolean;
  cited: boolean;
  citedUrl: string | null;
  modelName: string | null;
  responseExcerpt: string | null;
};

const GEO_RESPONSE_EXCERPT_MAX_CHARS = 1500;

function hostnameOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Fragt ein KI-Modell mit Websuche nach `prompt` und prüft Markenerwähnung (Text) + Quellenangabe (Domain) in der Antwort. */
export async function checkGeoVisibility(
  provider: GeoProvider,
  prompt: string,
  { brandName, targetDomain }: { brandName: string | null; targetDomain: string | null },
): Promise<DataForSeoResult<GeoVisibilityResult>> {
  const config = GEO_PROVIDER_CONFIG[provider];
  try {
    const body: Record<string, unknown> = { model_name: config.modelName, user_prompt: prompt.slice(0, 500), max_output_tokens: 600 };
    if (config.webSearchToggle) body.web_search = true;
    if (config.forceWebSearch) body.force_web_search = true;
    if (config.countryCode) body.web_search_country_iso_code = "DE";

    const rows = await postTask<Record<string, unknown>, RawGeoResult>(config.path, body);
    const result = rows[0];
    if (!result) return { ok: false, error: `${provider}: keine Antwort erhalten.` };

    const textSections = (result.items ?? []).flatMap((item) => (item.sections ?? []).filter((s) => s.type === "text"));
    const responseText = textSections
      .map((s) => s.text ?? "")
      .join("\n")
      .trim();
    const annotations = textSections.flatMap((s) => s.annotations ?? []);

    const mentioned = Boolean(brandName?.trim()) && responseText.toLowerCase().includes(brandName!.trim().toLowerCase());

    let citedUrl: string | null = null;
    if (targetDomain?.trim()) {
      const normalizedTarget = targetDomain.trim().toLowerCase().replace(/^www\./, "");
      for (const annotation of annotations) {
        const url = annotation.direct_url || annotation.url;
        if (!url) continue;
        const host = hostnameOf(url);
        if (host && (host === normalizedTarget || host.endsWith(`.${normalizedTarget}`))) {
          citedUrl = url;
          break;
        }
      }
    }

    return {
      ok: true,
      data: {
        mentioned,
        cited: citedUrl !== null,
        citedUrl,
        modelName: result.model_name ?? null,
        responseExcerpt: responseText ? responseText.slice(0, GEO_RESPONSE_EXCERPT_MAX_CHARS) : null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unbekannter Fehler bei der ${provider}-Abfrage.` };
  }
}
