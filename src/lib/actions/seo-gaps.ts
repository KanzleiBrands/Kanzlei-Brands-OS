"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getValidGscAccessToken, querySearchAnalytics } from "@/lib/google-search-console/client";

/**
 * Kostenlose Content-Lücken-Analyse (v1) auf Basis der eigenen Google-
 * Search-Console-Daten - die Alternative zu bezahlten Konkurrenz-Keyword-
 * Datenbanken wie Ahrefs/Semrush (Nutzerentscheidung, siehe Session). Sucht
 * "Striking-Distance"-Keywords: Suchanfragen, bei denen die eigene Seite
 * schon Impressionen bekommt, aber nur auf Seite 1 unten/Seite 2 rankt
 * (Position 4-20) - also für das Thema fast, aber noch nicht gut genug
 * gefunden wird. Klassische, kostenlose SEO-Technik.
 *
 * Läuft automatisch, sobald eine Google-Search-Console-Verbindung UND eine
 * Property ausgewählt sind (kein zusätzlicher An/Aus-Schalter nötig) -
 * analog zum automatischen Werbekosten-Sync, der ebenfalls allein am
 * Vorhandensein der Zugangsdaten hängt (siehe .env.example).
 */

const STRIKING_DISTANCE_MIN_POSITION = 4;
const STRIKING_DISTANCE_MAX_POSITION = 20;
const MIN_IMPRESSIONS = 5;
const LOOKBACK_DAYS = 28;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Vom Cron aufgerufen (api/cron/seo-gaps-sync). No-op, wenn keine Google-Search-Console-Verbindung/Property gesetzt ist. */
export async function syncSeoContentGaps(): Promise<{ found: number; skipped?: string }> {
  const connection = await prisma.googleSearchConsoleConnection.findUnique({ where: { id: "singleton" } });
  if (!connection) return { found: 0, skipped: "Keine Google-Search-Console-Verbindung vorhanden." };
  if (!connection.siteUrl) return { found: 0, skipped: "Noch keine Property ausgewählt." };

  try {
    const accessToken = await getValidGscAccessToken();
    const rows = await querySearchAnalytics(connection.siteUrl, accessToken, {
      startDate: isoDateDaysAgo(LOOKBACK_DAYS),
      endDate: isoDateDaysAgo(1),
    });

    const strikingDistance = rows.filter(
      (row) =>
        row.impressions >= MIN_IMPRESSIONS &&
        row.position >= STRIKING_DISTANCE_MIN_POSITION &&
        row.position <= STRIKING_DISTANCE_MAX_POSITION,
    );

    for (const row of strikingDistance) {
      await prisma.seoContentGap.upsert({
        where: { query: row.query },
        update: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, avgPosition: row.position },
        create: {
          query: row.query,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          avgPosition: row.position,
        },
      });
    }

    await prisma.googleSearchConsoleConnection.update({
      where: { id: "singleton" },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });

    revalidatePath("/dashboard/intern/marketing/seo");
    return { found: strikingDistance.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler bei der Content-Lücken-Analyse.";
    await prisma.googleSearchConsoleConnection.update({ where: { id: "singleton" }, data: { lastSyncError: message } });
    return { found: 0, skipped: message };
  }
}

/** "Jetzt analysieren"-Button in der Konfiguration - gleiche Logik, nur sofort statt auf den nächsten Cron-Lauf zu warten. */
export async function triggerSeoGapsSyncNow(): Promise<{ found: number; skipped?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { found: 0, skipped: "Keine Berechtigung." };
  return syncSeoContentGaps();
}

/** Verwirft eine Content-Lücke (z.B. nicht relevant) - taucht dann nicht mehr in der Lücken-Liste auf. */
export async function dismissSeoContentGap(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.seoContentGap.update({ where: { id }, data: { status: "DISMISSED" } }).catch(() => {});
  revalidatePath("/dashboard/intern/marketing/seo");
}
