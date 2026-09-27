import type { AdSpendResult, AdSpendRow } from "./types";

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202409";

/**
 * LinkedIn Marketing API (Ad Analytics) - braucht einen eigenen Access-Token
 * mit Ads-Reporting-Scope (r_ads_reporting/r_ads), getrennt von den
 * bestehenden LINKEDIN_CLIENT_ID/SECRET-Scopes fürs organische Posten
 * (Marketing Developer Platform muss diese Scopes separat freigeben, siehe
 * .env.example). LinkedIn-Access-Tokens sind ohne eigenes Refresh-Token-
 * Produkt ca. 60 Tage gültig - danach muss LINKEDIN_ADS_ACCESS_TOKEN manuell
 * erneuert werden. Ohne Token/Account-ID sauberes No-Op statt Crash.
 */
function toLinkedInDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

async function fetchCampaignNames(accountId: string, accessToken: string, campaignIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uncached = [...new Set(campaignIds)];
  if (uncached.length === 0) return names;

  const url = `${LINKEDIN_API_BASE}/adAccounts/${accountId}/adCampaigns?ids=List(${uncached.join(",")})`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0" },
  });
  if (!res.ok) return names;
  const json = (await res.json()) as { results?: Record<string, { name?: string }> };
  for (const [id, campaign] of Object.entries(json.results ?? {})) {
    if (campaign.name) names.set(id, campaign.name);
  }
  return names;
}

export async function fetchLinkedInAdSpend(dateFrom: string, dateTo: string): Promise<AdSpendResult> {
  const accessToken = process.env.LINKEDIN_ADS_ACCESS_TOKEN;
  const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID;
  if (!accessToken || !accountId) return { ok: false, error: "LINKEDIN_ADS_ACCESS_TOKEN / LINKEDIN_AD_ACCOUNT_ID ist nicht konfiguriert." };

  try {
    const from = toLinkedInDate(dateFrom);
    const to = toLinkedInDate(dateTo);
    const params = new URLSearchParams({
      q: "analytics",
      pivot: "CAMPAIGN",
      timeGranularity: "DAILY",
      "dateRange.start.day": String(from.day),
      "dateRange.start.month": String(from.month),
      "dateRange.start.year": String(from.year),
      "dateRange.end.day": String(to.day),
      "dateRange.end.month": String(to.month),
      "dateRange.end.year": String(to.year),
      fields: "dateRange,pivotValues,impressions,clicks,costInLocalCurrency",
    });
    params.append("accounts[0]", `urn:li:sponsoredAccount:${accountId}`);

    const res = await fetch(`${LINKEDIN_API_BASE}/adAnalytics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0" },
    });
    if (!res.ok) return { ok: false, error: `LinkedIn-Ads-Abfrage fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}` };

    const json = (await res.json()) as {
      elements: { dateRange: { start: { year: number; month: number; day: number } }; pivotValues: string[]; impressions: number; clicks: number; costInLocalCurrency: string }[];
    };

    const campaignIds = json.elements.map((e) => e.pivotValues[0]?.split(":").pop()).filter((id): id is string => !!id);
    const names = await fetchCampaignNames(accountId, accessToken, campaignIds);

    const rows: AdSpendRow[] = json.elements.map((e) => {
      const campaignId = e.pivotValues[0]?.split(":").pop() ?? "unknown";
      const d = e.dateRange.start;
      return {
        externalCampaignId: campaignId,
        campaignName: names.get(campaignId) ?? `LinkedIn-Kampagne ${campaignId}`,
        date: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
        amountSpent: Number(e.costInLocalCurrency) || 0,
        impressions: e.impressions,
        clicks: e.clicks,
      };
    });
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der LinkedIn-Ads-Abfrage." };
  }
}
