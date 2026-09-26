import { prisma } from "@/lib/prisma";
import type { DashboardPage } from "@prisma/client";

export type PageBlockDefinition = { key: string; label: string };

// The fixed, data-driven sections available on each client-facing dashboard
// page. Order here is only the fallback for blocks nobody has customized yet
// - see getPageLayout, which merges this with any saved PageLayoutBlock rows.
// Ein und derselbe Block-Katalog für jeden Abteilungs-Hub im internen Portal
// (siehe AgencyDepartment/DEPARTMENT_HUB_PAGE) - Ansprechpartner + Ressourcen
// werden zentral je Abteilung gepflegt (Settings -> Internes Portal), nicht
// pro Hub-Seite frei konfiguriert.
const DEPARTMENT_HUB_BLOCKS: PageBlockDefinition[] = [
  { key: "department_contact", label: "Ansprechpartner der Abteilung" },
  { key: "department_resources", label: "Assets/Ressourcen" },
  { key: "department_courses", label: "Zugewiesene Schulungen" },
];

export const PAGE_BLOCK_CATALOG: Record<DashboardPage, PageBlockDefinition[]> = {
  OVERVIEW: [
    { key: "leads_stats", label: "Mandatsakquise - Statistiken" },
    { key: "applicants_stats", label: "Bewerbungen - Statistiken" },
    { key: "potential_score", label: "Dein Potenzialscore" },
    { key: "campaigns_contacts", label: "Kampagnen & Neueste Kontakte" },
    { key: "social_content", label: "Social Media Content" },
  ],
  HUB: [
    { key: "contact_cards", label: "Ansprechpartner (Account Manager, Backoffice, Erreichbarkeit)" },
    { key: "resources", label: "Ressourcen" },
    { key: "campaign_requests", label: "Neue Kampagne einreichen" },
    { key: "offers", label: "Angebote" },
  ],
  SALES_HUB: DEPARTMENT_HUB_BLOCKS,
  BACKOFFICE_HUB: DEPARTMENT_HUB_BLOCKS,
  FULFILLMENT_HUB: DEPARTMENT_HUB_BLOCKS,
  MARKETING_HUB: DEPARTMENT_HUB_BLOCKS,
  EXECUTIVE_HUB: DEPARTMENT_HUB_BLOCKS,
};

export const PAGE_LABELS: Record<DashboardPage, string> = {
  OVERVIEW: "Übersicht",
  HUB: "Kunden-Hub",
  SALES_HUB: "Mein Dashboard - Vertrieb",
  BACKOFFICE_HUB: "Mein Dashboard - Backoffice",
  FULFILLMENT_HUB: "Mein Dashboard - Fulfillment",
  MARKETING_HUB: "Mein Dashboard - Marketing",
  EXECUTIVE_HUB: "Mein Dashboard - Geschäftsführung",
};

export type ResolvedPageBlock = PageBlockDefinition & { enabled: boolean };

export async function getPageLayout(page: DashboardPage): Promise<ResolvedPageBlock[]> {
  const catalog = PAGE_BLOCK_CATALOG[page];
  const rows = await prisma.pageLayoutBlock.findMany({ where: { page } });
  const rowByKey = new Map(rows.map((r) => [r.blockKey, r]));

  const withOrder = catalog.map((def, catalogIndex) => {
    const row = rowByKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      enabled: row?.enabled ?? true,
      sortOrder: row?.order ?? Number.MAX_SAFE_INTEGER,
      catalogIndex,
    };
  });
  withOrder.sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.catalogIndex - b.catalogIndex));
  return withOrder.map((b) => ({ key: b.key, label: b.label, enabled: b.enabled }));
}

export function isEnabled(blocks: ResolvedPageBlock[], key: string): boolean {
  return blocks.find((b) => b.key === key)?.enabled ?? true;
}
