"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getPlatformSettings } from "@/lib/actions/platform-settings";
import { isDataForSeoConfigured, getSearchVolumes, getBacklinkSummary, getCompetitorKeywordGaps } from "@/lib/dataforseo/client";

/**
 * DataForSEO-Erweiterung der SEO/GEO-Pipeline (siehe seo-gaps.ts für die
 * kostenlose GSC-Basis). Alle Funktionen hier sind bewusst nur manuell über
 * "Jetzt"-Buttons auslösbar (PlatformSettings.dataForSeoEnabled gated bisher
 * NUR einen künftigen Cron-Autostart, der noch nicht verdrahtet ist - der
 * Nutzer wollte erst über den manuellen Trigger die Kosten beobachten, bevor
 * es automatisch im täglichen seo-gaps-sync-Cron mitläuft).
 */

const SEO_TAB_PATH = "/dashboard/intern/marketing/seo";

function requireAgencyAdmin(role: string): void {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

async function touchDataForSeoSync(error: string | null): Promise<void> {
  await getPlatformSettings();
  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { dataForSeoLastSyncedAt: new Date(), dataForSeoLastSyncError: error },
  });
}

/** Schalter für den künftigen automatischen Cron-Lauf (aktuell noch nicht verdrahtet - siehe Modul-Kommentar). */
export async function toggleDataForSeoEnabled(): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const settings = await getPlatformSettings();
  await prisma.platformSettings.update({ where: { id: "singleton" }, data: { dataForSeoEnabled: !settings.dataForSeoEnabled } });
  revalidatePath(SEO_TAB_PATH);
}

/** Legt fest, welche Domain als "unsere Seite" für Backlink-Profil und Konkurrenz-Vergleich dient. */
export async function updateDataForSeoTargetDomain(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  await getPlatformSettings();
  await prisma.platformSettings.update({ where: { id: "singleton" }, data: { dataForSeoTargetDomain: domain || null } });
  revalidatePath(SEO_TAB_PATH);
}

/** "Suchvolumen jetzt anreichern"-Button: ergänzt echtes Google-Suchvolumen bei offenen GSC-Content-Lücken. */
export async function triggerSearchVolumeEnrichmentNow(): Promise<{ enriched: number; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { enriched: 0, error: "Keine Berechtigung." };
  if (!isDataForSeoConfigured()) return { enriched: 0, error: "DataForSEO ist nicht konfiguriert (siehe .env.example)." };

  const gaps = await prisma.seoContentGap.findMany({ where: { status: "NEW" }, select: { id: true, query: true } });
  if (gaps.length === 0) return { enriched: 0 };

  const result = await getSearchVolumes(gaps.map((g) => g.query));
  if (!result.ok) {
    await touchDataForSeoSync(result.error);
    return { enriched: 0, error: result.error };
  }

  let enriched = 0;
  for (const gap of gaps) {
    const info = result.data.get(gap.query.toLowerCase());
    if (!info) continue;
    await prisma.seoContentGap.update({ where: { id: gap.id }, data: { searchVolume: info.searchVolume, cpc: info.cpc } });
    enriched++;
  }

  await touchDataForSeoSync(null);
  revalidatePath(SEO_TAB_PATH);
  return { enriched };
}

/** Fügt eine Konkurrenz-Domain (andere Kanzlei) für den Keyword-Vergleich hinzu. */
export async function addSeoCompetitorDomain(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) return;
  const label = String(formData.get("label") ?? "").trim() || null;

  await prisma.seoCompetitorDomain.create({ data: { domain, label } }).catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}

export async function removeSeoCompetitorDomain(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const id = String(formData.get("id") ?? "");
  await prisma.seoCompetitorDomain.delete({ where: { id } }).catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}

/** "Jetzt vergleichen"-Button: für jede hinterlegte Konkurrenz-Domain die Keyword-Lücken gegen unsere Zieldomain abfragen. */
export async function triggerCompetitorGapsSyncNow(): Promise<{ found: number; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { found: 0, error: "Keine Berechtigung." };
  if (!isDataForSeoConfigured()) return { found: 0, error: "DataForSEO ist nicht konfiguriert (siehe .env.example)." };

  const settings = await getPlatformSettings();
  if (!settings.dataForSeoTargetDomain) return { found: 0, error: "Bitte zuerst die eigene Zieldomain in der Konfiguration setzen." };

  const competitors = await prisma.seoCompetitorDomain.findMany();
  if (competitors.length === 0) return { found: 0, error: "Noch keine Konkurrenz-Domain hinterlegt." };

  let total = 0;
  for (const competitor of competitors) {
    const result = await getCompetitorKeywordGaps(competitor.domain, settings.dataForSeoTargetDomain, 100);
    if (!result.ok) {
      await touchDataForSeoSync(`${competitor.domain}: ${result.error}`);
      return { found: total, error: `${competitor.domain}: ${result.error}` };
    }
    for (const row of result.data) {
      await prisma.seoCompetitorKeywordGap.upsert({
        where: { competitorDomainId_keyword: { competitorDomainId: competitor.id, keyword: row.keyword } },
        update: { searchVolume: row.searchVolume, competitorPosition: row.competitorPosition, ourPosition: row.ourPosition },
        create: {
          competitorDomainId: competitor.id,
          keyword: row.keyword,
          searchVolume: row.searchVolume,
          competitorPosition: row.competitorPosition,
          ourPosition: row.ourPosition,
        },
      });
    }
    total += result.data.length;
  }

  await touchDataForSeoSync(null);
  revalidatePath(SEO_TAB_PATH);
  return { found: total };
}

/** Verwirft eine Konkurrenz-Keyword-Lücke (z.B. nicht relevant für unsere Leistungen). */
export async function dismissCompetitorGap(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.seoCompetitorKeywordGap.update({ where: { id }, data: { status: "DISMISSED" } }).catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}

/** "Backlink-Profil jetzt aktualisieren"-Button: Live-Snapshot der eigenen Zieldomain. */
export async function triggerBacklinkProfileSyncNow(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { ok: false, error: "Keine Berechtigung." };
  if (!isDataForSeoConfigured()) return { ok: false, error: "DataForSEO ist nicht konfiguriert (siehe .env.example)." };

  const settings = await getPlatformSettings();
  if (!settings.dataForSeoTargetDomain) return { ok: false, error: "Bitte zuerst die eigene Zieldomain in der Konfiguration setzen." };

  const result = await getBacklinkSummary(settings.dataForSeoTargetDomain);
  if (!result.ok) {
    await prisma.seoBacklinkProfile.upsert({
      where: { id: "singleton" },
      update: { domain: settings.dataForSeoTargetDomain, fetchError: result.error },
      create: { id: "singleton", domain: settings.dataForSeoTargetDomain, fetchError: result.error },
    });
    revalidatePath(SEO_TAB_PATH);
    return { ok: false, error: result.error };
  }

  await prisma.seoBacklinkProfile.upsert({
    where: { id: "singleton" },
    update: { domain: settings.dataForSeoTargetDomain, ...result.data, fetchedAt: new Date(), fetchError: null },
    create: { id: "singleton", domain: settings.dataForSeoTargetDomain, ...result.data, fetchedAt: new Date() },
  });
  revalidatePath(SEO_TAB_PATH);
  return { ok: true };
}
