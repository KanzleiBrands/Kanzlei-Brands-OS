// Every key that has ever been offered/stored stays here so existing
// endpoints and contacts (created before the source list was trimmed down)
// keep rendering correctly. Only WEBHOOK_FORM_SOURCES/DIRECT_INTEGRATION_SOURCES
// below control what can be newly selected in the "Quelle hinzufügen" dialog.
export const WEBHOOK_SOURCE_LABELS: Record<string, string> = {
  GENERIC: "Generisch / Sonstige",
  ZAPIER: "Zapier",
  GOOGLE_ADS: "Google Ads",
  ONEPAGE: "OnePage",
  PERSPEKTIVE: "Perspektive",
  META_LEAD_ADS: "Meta Ads",
  LINKEDIN_LEAD_GEN: "LinkedIn Ads",
  ELEMENTOR: "Elementor",
  TYPEFORM: "TypeForm",
  FUNNELCOCKPIT: "FunnelCockpit",
  HEYFLOW: "HeyFlow",
  MEETOVO: "Meetovo",
  AIDAFORM: "AidaForm",
  THRIVE: "Thrive",
  MATELSO: "matelso (Call Tracking)",
};

export const WEBHOOK_SOURCE_DESCRIPTIONS: Record<string, string> = {
  GENERIC: "Für individuelle Formulare & alles mit JSON-Webhook",
  ZAPIER: "Verbindet tausende Tools über Zapier",
  GOOGLE_ADS: "Google Ads Lead-Formulare",
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
  MATELSO: "Anrufer-Leads aus Google-Ads-Landingpages (Dynamic Number Insertion)",
};

export const WEBHOOK_SOURCE_COLORS: Record<string, string> = {
  GENERIC: "#6B7280",
  ZAPIER: "#F97316",
  GOOGLE_ADS: "#4285F4",
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
  MATELSO: "#0F766E",
};

// "Formular/Webhook"-style sources: shown as copy-the-URL tiles.
export const WEBHOOK_FORM_SOURCES = ["GENERIC", "MATELSO"] as const;

// Native/ads-platform sources, grouped separately as "Direktintegrationen".
// META_LEAD_ADS is deliberately excluded here: it has its own real OAuth
// connect flow now (MetaConnectionsPanel/"+ Verbinden"), not a generic
// webhook token like the sources below still are.
export const DIRECT_INTEGRATION_SOURCES = ["GOOGLE_ADS", "LINKEDIN_LEAD_GEN"] as const;

export const WEBHOOK_SOURCES = [...WEBHOOK_FORM_SOURCES, ...DIRECT_INTEGRATION_SOURCES] as const;
