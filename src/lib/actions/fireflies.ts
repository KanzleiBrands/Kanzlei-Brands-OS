"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getPlatformSettings } from "@/lib/actions/platform-settings";
import { listAllFirefliesTranscripts, getFirefliesTranscriptText } from "@/lib/fireflies/client";

/**
 * Fireflies-Sync fürs interne Marketing-Center: zieht Call-Transkripte (Sales
 * Calls, Kunden Calls etc.) als Rohmaterial für die KI-Ideen-Generierung
 * (siehe content-ideas.ts) in die gemeinsame CallTranscript-Tabelle (source:
 * FIREFLIES - siehe auch close-calls.ts für die Close.io-Variante). Agentur-
 * weit, nicht pro Kunde - sichtbar nur im internen Marketing-Center
 * (isInternalOrg), siehe content-pyramid-overview.tsx für das analoge
 * "nur intern sichtbar"-Muster.
 *
 * firefliesSyncEnabled defaultet in der DB auf false (CLAUDE.md-Automations-
 * regel) - für diese Einführung wurde die Live-Schaltung vor dem Bau bewusst
 * mit dem Nutzer abgestimmt (siehe PlatformSettings-Modell-Kommentar).
 */

const INITIAL_BACKFILL_DAYS = 90;
// Obergrenzen pro Lauf, damit ein großer Rückstand (initialer Backfill) die
// Funktion nicht in einen Serverless-Timeout laufen lässt - der nächste
// Cron-Lauf (alle 30 Minuten, siehe vercel.json) macht automatisch dort
// weiter, wo dieser aufgehört hat (fromDate = letzter gespeicherter Call).
const MAX_LIST_PAGES_PER_RUN = 10; // 10 x 50 = 500 Metadaten-Einträge pro Lauf
const MAX_DETAIL_FETCHES_PER_RUN = 25; // volle Transkripte sind teurer als Metadaten

/** An/Aus-Schalter im Konfiguration-Reiter des internen Marketing-Centers - nur AGENCY_ADMIN. */
export async function togglePlatformFirefliesSync(): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const settings = await getPlatformSettings();
  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { firefliesSyncEnabled: !settings.firefliesSyncEnabled },
  });
  revalidatePath("/dashboard/intern/marketing/social");
}

/**
 * Eigentliche Sync-Logik, unabhängig vom Automatik-Schalter - sowohl vom Cron
 * (nur wenn firefliesSyncEnabled) als auch vom "Jetzt synchronisieren"-Button
 * (immer, da ein expliziter Klick unabhängig vom Hintergrund-Automatik-
 * Schalter gilt - analog zu syncReferenceAccountNow) genutzt.
 *
 * Ablauf: 1) Metadaten+Summary aller Calls seit dem letzten gespeicherten
 * Call (oder 90 Tage zurück beim allerersten Lauf) paginiert abholen und
 * sofort speichern. 2) Für die neuesten noch unvollständigen Einträge
 * (transcriptText noch null) den vollen Transkripttext nachladen. Ein
 * einzelner fehlgeschlagener Call bricht den restlichen Batch nicht ab.
 */
async function runFirefliesSync(apiKey: string): Promise<{ synced: number; failed: number; skipped?: string }> {
  const latest = await prisma.callTranscript.findFirst({
    where: { source: "FIREFLIES" },
    orderBy: { dateTime: "desc" },
    select: { dateTime: true },
  });
  const fromDate = latest?.dateTime ?? new Date(Date.now() - INITIAL_BACKFILL_DAYS * 24 * 60 * 60 * 1000);

  let synced = 0;
  let failed = 0;

  try {
    const { items } = await listAllFirefliesTranscripts(apiKey, fromDate, MAX_LIST_PAGES_PER_RUN);

    const existingIds = new Set(
      (
        await prisma.callTranscript.findMany({
          where: { source: "FIREFLIES", externalId: { in: items.map((i) => i.firefliesId) } },
          select: { externalId: true },
        })
      ).map((r) => r.externalId),
    );

    for (const item of items) {
      if (existingIds.has(item.firefliesId)) continue;
      try {
        await prisma.callTranscript.create({
          data: {
            source: "FIREFLIES",
            externalId: item.firefliesId,
            title: item.title,
            dateTime: item.dateTime,
            durationMinutes: item.durationMinutes,
            organizerEmail: item.organizerEmail,
            participants: item.participants,
            meetingUrl: item.meetingUrl,
            summaryOverview: item.summaryOverview,
          },
        });
      } catch (error) {
        failed++;
        console.error("[fireflies] Metadaten-Speicherung fehlgeschlagen", item.firefliesId, error);
      }
    }

    const pendingDetail = await prisma.callTranscript.findMany({
      where: { source: "FIREFLIES", transcriptText: null },
      orderBy: { dateTime: "desc" },
      take: MAX_DETAIL_FETCHES_PER_RUN,
      select: { id: true, externalId: true },
    });

    for (const row of pendingDetail) {
      try {
        const text = await getFirefliesTranscriptText(apiKey, row.externalId);
        await prisma.callTranscript.update({ where: { id: row.id }, data: { transcriptText: text ?? "" } });
        synced++;
      } catch (error) {
        failed++;
        console.error("[fireflies] Transkript-Fetch fehlgeschlagen", row.externalId, error);
      }
    }

    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { firefliesLastSyncedAt: new Date(), firefliesLastSyncError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Fireflies-Sync.";
    await prisma.platformSettings.update({ where: { id: "singleton" }, data: { firefliesLastSyncError: message } });
    return { synced, failed, skipped: message };
  }

  revalidatePath("/dashboard/intern/marketing/social");
  return { synced, failed };
}

/** Vom Cron aufgerufen (api/cron/fireflies-sync). No-op, wenn kein API-Key gesetzt oder der Automatik-Schalter aus ist. */
export async function syncFirefliesTranscripts(): Promise<{ synced: number; failed: number; skipped?: string }> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) return { synced: 0, failed: 0, skipped: "FIREFLIES_API_KEY ist nicht konfiguriert." };

  const settings = await getPlatformSettings();
  if (!settings.firefliesSyncEnabled) return { synced: 0, failed: 0, skipped: "Fireflies-Sync ist deaktiviert." };

  return runFirefliesSync(apiKey);
}

/** "Jetzt synchronisieren"-Button in der Konfiguration - läuft unabhängig vom Automatik-Schalter, nur AGENCY_ADMIN. */
export async function triggerFirefliesSyncNow(): Promise<{ synced: number; failed: number; skipped?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { synced: 0, failed: 0, skipped: "Keine Berechtigung." };

  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) return { synced: 0, failed: 0, skipped: "FIREFLIES_API_KEY ist nicht konfiguriert." };

  return runFirefliesSync(apiKey);
}
