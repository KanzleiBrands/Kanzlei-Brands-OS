import type { AdSpendResult, AdSpendRow } from "./types";

const GOOGLE_ADS_API_VERSION = "v18";

/**
 * Google Ads API (GAQL) - braucht einen einmalig erzeugten Refresh-Token
 * (siehe .env.example) plus einen von Google genehmigten Developer-Token.
 * Der Access-Token wird pro Aufruf frisch aus dem Refresh-Token geholt (kurz
 * gültig, kein eigenes Caching nötig bei täglichem Cron). Ohne vollständige
 * Konfiguration sauberes No-Op statt Crash.
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`Google-OAuth-Token-Refresh fehlgeschlagen (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function fetchGoogleAdSpend(dateFrom: string, dateTo: string): Promise<AdSpendResult> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!developerToken || !customerId) {
    return { ok: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CUSTOMER_ID ist nicht konfiguriert." };
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return { ok: false, error: "GOOGLE_ADS_CLIENT_ID / SECRET / REFRESH_TOKEN ist nicht konfiguriert." };

    const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks
      FROM campaign
      WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    const res = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { ok: false, error: `Google-Ads-Abfrage fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}` };

    const json = (await res.json()) as {
      results?: {
        campaign: { id: string; name: string };
        segments: { date: string };
        metrics: { costMicros: string; impressions: string; clicks: string };
      }[];
    };

    const rows: AdSpendRow[] = (json.results ?? []).map((r) => ({
      externalCampaignId: r.campaign.id,
      campaignName: r.campaign.name,
      date: r.segments.date,
      amountSpent: Number(r.metrics.costMicros ?? 0) / 1_000_000,
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
    }));
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Google-Ads-Abfrage." };
  }
}
