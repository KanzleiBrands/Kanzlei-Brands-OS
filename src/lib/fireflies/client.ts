/**
 * Minimaler Fireflies-GraphQL-Client - zieht Call-Transkripte (Sales Calls,
 * Kunden-Calls etc.) als Rohmaterial für die KI-Ideen-Generierung im internen
 * Marketing-Center (siehe src/lib/actions/fireflies.ts, content-ideas.ts).
 * API: https://docs.fireflies.ai/graphql-api - Auth per Bearer-Token
 * (FIREFLIES_API_KEY, Settings > Developer Settings in Fireflies). Bewusst
 * zweistufig: die Listenabfrage holt nur Metadaten + KI-Summary (billig,
 * paginierbar), der volle Transkripttext (sentences) wird erst gezielt pro
 * neuem Call per Detail-Abfrage nachgeladen - sonst würde die Listenabfrage
 * bei vielen Calls sehr groß/langsam.
 */
const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fireflies rate-limited gelegentlich (429) - kurzer Retry mit Backoff statt sofortigem Fehler, analog zum EasyBill-Client. */
async function firefliesFetch(query: string, variables: Record<string, unknown>, apiKey: string): Promise<Response> {
  const maxAttempts = 3;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status !== 429 || attempt >= maxAttempts) return res;
    await sleep(attempt * 1500);
  }
}

async function firefliesGraphQL<T>(query: string, variables: Record<string, unknown>, apiKey: string): Promise<T> {
  const res = await firefliesFetch(query, variables, apiKey);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fireflies-Anfrage fehlgeschlagen (${res.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  // GraphQL-Fehler kommen mit HTTP 200 zurück, siehe "errors"-Array.
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Fireflies-API-Fehler: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Fireflies-Antwort ohne Daten.");
  return json.data;
}

export type FirefliesTranscriptListItem = {
  firefliesId: string;
  title: string;
  dateTime: Date;
  durationMinutes: number | null;
  organizerEmail: string | null;
  participants: string[];
  meetingUrl: string | null;
  summaryOverview: string | null;
};

// Fireflies-Maximum pro Seite laut Doku (docs.fireflies.ai/graphql-api/query/transcripts).
const LIST_PAGE_SIZE = 50;

const TRANSCRIPTS_LIST_QUERY = `
  query Transcripts($fromDate: DateTime, $limit: Int, $skip: Int) {
    transcripts(fromDate: $fromDate, limit: $limit, skip: $skip) {
      id
      title
      date
      duration
      organizer_email
      participants
      transcript_url
      summary {
        overview
        short_summary
      }
    }
  }
`;

type RawTranscriptListItem = {
  id: string;
  title: string;
  date: number;
  duration: number | null;
  organizer_email: string | null;
  participants: string[] | null;
  transcript_url: string | null;
  summary: { overview: string | null; short_summary: string | null } | null;
};

async function listFirefliesTranscriptsPage(
  apiKey: string,
  fromDate: Date,
  skip: number,
): Promise<FirefliesTranscriptListItem[]> {
  const data = await firefliesGraphQL<{ transcripts: RawTranscriptListItem[] }>(
    TRANSCRIPTS_LIST_QUERY,
    { fromDate: fromDate.toISOString(), limit: LIST_PAGE_SIZE, skip },
    apiKey,
  );
  return data.transcripts.map((t) => ({
    firefliesId: t.id,
    title: t.title || "(ohne Titel)",
    dateTime: new Date(t.date),
    durationMinutes: t.duration,
    organizerEmail: t.organizer_email,
    participants: t.participants ?? [],
    meetingUrl: t.transcript_url,
    summaryOverview: t.summary?.overview?.trim() || t.summary?.short_summary?.trim() || null,
  }));
}

/**
 * Blättert ab `fromDate` durch alle Seiten, bis eine kleiner als die
 * Maximalgröße zurückkommt (= letzte Seite) oder `maxPages` erreicht ist -
 * Obergrenze pro Cron-Lauf, damit ein großer Rückstand (z.B. beim initialen
 * 90-Tage-Backfill) die Funktion nicht in einen Timeout laufen lässt. Ein
 * `truncated: true` bedeutet, dass noch weitere Seiten offen sind - der
 * nächste Cron-Lauf macht automatisch dort weiter, wo der letzte gespeicherte
 * Call aufgehört hat (siehe syncFirefliesTranscripts).
 */
export async function listAllFirefliesTranscripts(
  apiKey: string,
  fromDate: Date,
  maxPages: number,
): Promise<{ items: FirefliesTranscriptListItem[]; truncated: boolean }> {
  const items: FirefliesTranscriptListItem[] = [];
  let skip = 0;
  for (let page = 0; page < maxPages; page++) {
    const batch = await listFirefliesTranscriptsPage(apiKey, fromDate, skip);
    items.push(...batch);
    if (batch.length < LIST_PAGE_SIZE) return { items, truncated: false };
    skip += LIST_PAGE_SIZE;
  }
  return { items, truncated: true };
}

const TRANSCRIPT_DETAIL_QUERY = `
  query TranscriptDetail($id: String!) {
    transcript(id: $id) {
      id
      sentences {
        speaker_name
        text
      }
    }
  }
`;

type RawTranscriptDetail = {
  transcript: { id: string; sentences: { speaker_name: string | null; text: string }[] | null } | null;
};

/** Voller Transkripttext (zeilenweise "Sprecher: Satz") für genau einen Call - erst beim ersten Sync eines neuen Calls geladen. */
export async function getFirefliesTranscriptText(apiKey: string, firefliesId: string): Promise<string | null> {
  const data = await firefliesGraphQL<RawTranscriptDetail>(TRANSCRIPT_DETAIL_QUERY, { id: firefliesId }, apiKey);
  const sentences = data.transcript?.sentences;
  if (!sentences || sentences.length === 0) return null;
  return sentences.map((s) => (s.speaker_name ? `${s.speaker_name}: ${s.text}` : s.text)).join("\n");
}
