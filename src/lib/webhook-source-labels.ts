export const WEBHOOK_SOURCE_LABELS: Record<string, string> = {
  GENERIC: "Generisch",
  ZAPIER: "Zapier",
  ONEPAGE: "OnePage",
  PERSPEKTIVE: "Perspektive",
  META_LEAD_ADS: "Meta Ads",
  LINKEDIN_LEAD_GEN: "LinkedIn",
  ELEMENTOR: "Elementor",
  TYPEFORM: "TypeForm",
  FUNNELCOCKPIT: "FunnelCockpit",
  HEYFLOW: "HeyFlow",
  MEETOVO: "Meetovo",
  AIDAFORM: "AidaForm",
  THRIVE: "Thrive",
};

export const WEBHOOK_SOURCE_DESCRIPTIONS: Record<string, string> = {
  GENERIC: "Für individuelle Formulare & alles mit JSON-Webhook",
  ZAPIER: "Verbindet tausende Tools über Zapier",
  ONEPAGE: "Bewerbungen aus OnePage",
  PERSPEKTIVE: "Bewerbungen aus Perspektive",
  META_LEAD_ADS: "Facebook & Instagram Lead-Formulare",
  LINKEDIN_LEAD_GEN: "LinkedIn Lead Gen Forms",
  ELEMENTOR: "Formulare aus Elementor (WordPress)",
  TYPEFORM: "Formulare aus TypeForm",
  FUNNELCOCKPIT: "Funnels aus FunnelCockpit",
  HEYFLOW: "Flows aus HeyFlow",
  MEETOVO: "Bewerber-Funnels aus Meetovo",
  AIDAFORM: "Formulare aus AidaForm",
  THRIVE: "Formulare aus Thrive Themes",
};

export const WEBHOOK_SOURCE_COLORS: Record<string, string> = {
  GENERIC: "#6B7280",
  ZAPIER: "#F97316",
  ONEPAGE: "#8B5CF6",
  PERSPEKTIVE: "#14B8A6",
  META_LEAD_ADS: "#1877F2",
  LINKEDIN_LEAD_GEN: "#0A66C2",
  ELEMENTOR: "#92003B",
  TYPEFORM: "#262627",
  FUNNELCOCKPIT: "#111827",
  HEYFLOW: "#4F46E5",
  MEETOVO: "#EC4899",
  AIDAFORM: "#0EA5E9",
  THRIVE: "#16A34A",
};

// "Formular/Webhook"-style sources: shown as copy-the-URL tiles.
export const WEBHOOK_FORM_SOURCES = [
  "GENERIC",
  "ZAPIER",
  "ONEPAGE",
  "PERSPEKTIVE",
  "ELEMENTOR",
  "TYPEFORM",
  "FUNNELCOCKPIT",
  "HEYFLOW",
  "MEETOVO",
  "AIDAFORM",
  "THRIVE",
] as const;

// Native/ads-platform sources, grouped separately as "Direktintegrationen".
export const DIRECT_INTEGRATION_SOURCES = ["META_LEAD_ADS", "LINKEDIN_LEAD_GEN"] as const;

export const WEBHOOK_SOURCES = [...WEBHOOK_FORM_SOURCES, ...DIRECT_INTEGRATION_SOURCES] as const;
