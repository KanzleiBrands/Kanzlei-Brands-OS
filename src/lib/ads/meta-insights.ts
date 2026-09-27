import type { AdSpendResult, AdSpendRow } from "./types";

const GRAPH_VERSION = "v21.0";

/**
 * Meta Marketing API (Insights, nicht die Content-Publishing-Graph-API in
 * src/lib/meta/graph.ts) - braucht einen eigenen System-User-Access-Token
 * mit ads_read-Scope (Business Manager > Systembenutzer), da die
 * bestehenden META_APP_ID/SECRET-Flows nur Content-/Lead-Ads-Scopes haben.
 * Setup siehe .env.example. Ohne Token/Ad-Account-ID sauberes No-Op statt
 * Crash, wie überall sonst in diesem Codebase.
 */
export async function fetchMetaAdSpend(dateFrom: string, dateTo: string): Promise<AdSpendResult> {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !adAccountId) return { ok: false, error: "META_ADS_ACCESS_TOKEN / META_AD_ACCOUNT_ID ist nicht konfiguriert." };

  try {
    const rows: AdSpendRow[] = [];
    let url: string | null =
      `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/insights?` +
      new URLSearchParams({
        level: "campaign",
        time_increment: "1",
        fields: "campaign_id,campaign_name,spend,impressions,clicks,date_start",
        time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
        access_token: accessToken,
        limit: "500",
      }).toString();

    while (url) {
      const res: Response = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `Meta-Insights-Abfrage fehlgeschlagen (${res.status}): ${body.slice(0, 300)}` };
      }
      const json: {
        data: { campaign_id: string; campaign_name: string; spend: string; impressions: string; clicks: string; date_start: string }[];
        paging?: { next?: string };
      } = await res.json();
      for (const row of json.data) {
        rows.push({
          externalCampaignId: row.campaign_id,
          campaignName: row.campaign_name,
          date: row.date_start,
          amountSpent: Number(row.spend) || 0,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
        });
      }
      url = json.paging?.next ?? null;
    }
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Meta-Insights-Abfrage." };
  }
}
