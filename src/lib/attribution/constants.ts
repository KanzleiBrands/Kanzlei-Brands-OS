import type { AdPlatform, ClickIdType } from "@prisma/client";

/** Query-Param-Namen der Click-IDs, die das Tracking-Snippet (public/tracking.js) erfasst. */
export const CLICK_ID_PARAMS: Record<ClickIdType, string> = {
  FBCLID: "fbclid",
  GCLID: "gclid",
  GBRAID: "gbraid",
  WBRAID: "wbraid",
  MSCLKID: "msclkid",
  LI_FAT_ID: "li_fat_id",
};

/** Erste passende Click-ID aus einem Query-String/Objekt herauslesen - pro Landing ist immer nur eine gesetzt. */
export function extractClickId(params: URLSearchParams | Record<string, string | null | undefined>): {
  type: ClickIdType;
  value: string;
} | null {
  const get = (key: string) => (params instanceof URLSearchParams ? params.get(key) : (params[key] ?? null));
  for (const [type, param] of Object.entries(CLICK_ID_PARAMS) as [ClickIdType, string][]) {
    const value = get(param);
    if (value) return { type, value };
  }
  return null;
}

/** Leitet die Plattform aus utm_source (bzw. Click-ID als Fallback) ab - fürs Auto-Anlegen von AdCampaign. */
export function resolvePlatform(utmSource: string | null | undefined, clickIdType: ClickIdType | null): AdPlatform {
  const source = (utmSource ?? "").toLowerCase();
  if (source.includes("facebook") || source.includes("meta") || source.includes("instagram") || clickIdType === "FBCLID") return "META";
  if (source.includes("google") || clickIdType === "GCLID" || clickIdType === "GBRAID" || clickIdType === "WBRAID") return "GOOGLE";
  if (source.includes("linkedin") || clickIdType === "LI_FAT_ID") return "LINKEDIN";
  if (source === "organic" || source === "organisch") return "ORGANIC";
  if (source === "direct" || source === "direkt" || !source) return "DIRECT";
  return "OTHER";
}

export const PLATFORM_LABELS: Record<AdPlatform, string> = {
  META: "Meta",
  GOOGLE: "Google",
  LINKEDIN: "LinkedIn",
  ORGANIC: "Organisch",
  DIRECT: "Direkt",
  OTHER: "Sonstige",
};

export const JOURNEY_EVENT_LABELS = {
  LEAD_CREATED: "Lead erstellt",
  QUALI_CALL_BOOKED: "Quali-Call gebucht",
  QUALI_CALL_DONE: "Quali-Call durchgeführt",
  QUALI_CALL_NO_SHOW: "Quali-Call nicht erschienen",
  SALES_CALL_1_BOOKED: "Sales-Call 1 gebucht",
  SALES_CALL_1_DONE: "Sales-Call 1 durchgeführt",
  SALES_CALL_1_NO_SHOW: "Sales-Call 1 nicht erschienen",
  SALES_CALL_2_BOOKED: "Sales-Call 2 gebucht",
  SALES_CALL_2_DONE: "Sales-Call 2 durchgeführt",
  SALES_CALL_2_NO_SHOW: "Sales-Call 2 nicht erschienen",
  UPSELL: "Upsell",
  DEAL_WON: "Deal gewonnen",
  DEAL_LOST: "Deal verloren",
} as const;

/** Domains, die nicht als Firmen-Domain zählen (private/generische Mail-Anbieter) - Candidate bekommt dann keine gemeinsame CandidateAccount-Domain. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "web.de",
  "gmx.de",
  "gmx.net",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "yahoo.com",
  "yahoo.de",
  "icloud.com",
  "t-online.de",
  "posteo.de",
]);

export function extractCompanyDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}
