export type AdSpendRow = {
  externalCampaignId: string;
  campaignName: string;
  date: string; // YYYY-MM-DD
  amountSpent: number;
  impressions: number;
  clicks: number;
};

export type AdSpendResult = { ok: true; rows: AdSpendRow[] } | { ok: false; error: string };
