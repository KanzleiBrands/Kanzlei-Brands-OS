export const WEBHOOK_SOURCE_LABELS: Record<string, string> = {
  GENERIC: "Generischer Webhook",
  ZAPIER: "Zapier",
  ONEPAGE: "OnePage",
  PERSPEKTIVE: "Perspektive",
  META_LEAD_ADS: "Meta Ads",
  LINKEDIN_LEAD_GEN: "LinkedIn",
};

export const WEBHOOK_SOURCE_DESCRIPTIONS: Record<string, string> = {
  GENERIC: "Für Elementor, Typeform, individuelle Formulare & alles mit JSON-Webhook",
  ZAPIER: "Verbindet tausende Tools über Zapier",
  ONEPAGE: "Bewerbungen aus OnePage",
  PERSPEKTIVE: "Bewerbungen aus Perspektive",
  META_LEAD_ADS: "Facebook & Instagram Lead-Formulare",
  LINKEDIN_LEAD_GEN: "LinkedIn Lead Gen Forms",
};

export const WEBHOOK_SOURCE_COLORS: Record<string, string> = {
  GENERIC: "#6B7280",
  ZAPIER: "#F97316",
  ONEPAGE: "#8B5CF6",
  PERSPEKTIVE: "#14B8A6",
  META_LEAD_ADS: "#1877F2",
  LINKEDIN_LEAD_GEN: "#0A66C2",
};

export const WEBHOOK_SOURCES = [
  "GENERIC",
  "ZAPIER",
  "ONEPAGE",
  "PERSPEKTIVE",
  "META_LEAD_ADS",
  "LINKEDIN_LEAD_GEN",
] as const;
