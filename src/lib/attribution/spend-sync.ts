import { prisma } from "@/lib/prisma";
import type { AdPlatform } from "@prisma/client";
import { fetchMetaAdSpend } from "@/lib/ads/meta-insights";
import { fetchGoogleAdSpend } from "@/lib/ads/google-ads-insights";
import { fetchLinkedInAdSpend } from "@/lib/ads/linkedin-insights";
import type { AdSpendResult } from "@/lib/ads/types";

const PLATFORM_FETCHERS: { platform: AdPlatform; fetch: (from: string, to: string) => Promise<AdSpendResult> }[] = [
  { platform: "META", fetch: fetchMetaAdSpend },
  { platform: "GOOGLE", fetch: fetchGoogleAdSpend },
  { platform: "LINKEDIN", fetch: fetchLinkedInAdSpend },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type SpendSyncResult = { platform: AdPlatform; ok: boolean; rowsWritten: number; error?: string }[];

/**
 * Nächtlicher Abgleich der echten Werbekosten je Plattform (siehe
 * src/app/api/cron/ad-spend-sync/route.ts) - läuft automatisch, sobald die
 * jeweiligen Ads-API-Zugänge in den Env-Vars gesetzt sind (.env.example),
 * vorher sauberes No-Op je Plattform statt Crash. Nimmt bewusst die letzten
 * 4 Tage statt nur "gestern" mit, weil Plattformen Spend-Zahlen rückwirkend
 * bis zu 72h korrigieren (siehe Recherche zu Attributionstools).
 *
 * Kampagnen-Zuordnung: matcht per (organizationId, platform, Kampagnenname)
 * auf eine ggf. bereits per UTM angelegte AdCampaign - Voraussetzung ist,
 * dass utm_campaign im Tracking-Snippet identisch zum echten Kampagnennamen
 * in der jeweiligen Werbeplattform gewählt wird (gängige Konvention).
 */
export async function syncAdSpend(organizationId: string): Promise<SpendSyncResult> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 4);
  const dateFrom = isoDate(from);
  const dateTo = isoDate(to);

  const results: SpendSyncResult = [];

  for (const { platform, fetch } of PLATFORM_FETCHERS) {
    const result = await fetch(dateFrom, dateTo);
    if (!result.ok) {
      results.push({ platform, ok: false, rowsWritten: 0, error: result.error });
      continue;
    }

    let rowsWritten = 0;
    for (const row of result.rows) {
      const campaign = await prisma.adCampaign.upsert({
        where: { organizationId_platform_name: { organizationId, platform, name: row.campaignName } },
        create: { organizationId, platform, name: row.campaignName, externalCampaignId: row.externalCampaignId },
        update: { externalCampaignId: row.externalCampaignId },
      });
      await prisma.adSpendEntry.upsert({
        where: { organizationId_campaignId_platform_date: { organizationId, campaignId: campaign.id, platform, date: new Date(row.date) } },
        create: {
          organizationId,
          campaignId: campaign.id,
          platform,
          date: new Date(row.date),
          amountSpent: row.amountSpent,
          impressions: row.impressions,
          clicks: row.clicks,
          source: "API",
        },
        update: { amountSpent: row.amountSpent, impressions: row.impressions, clicks: row.clicks, source: "API" },
      });
      rowsWritten += 1;
    }
    results.push({ platform, ok: true, rowsWritten });
  }

  return results;
}
