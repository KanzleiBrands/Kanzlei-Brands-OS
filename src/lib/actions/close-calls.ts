"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getPlatformSettings } from "@/lib/actions/platform-settings";
import { listCloseCallCandidates, getCloseCallTranscript } from "@/lib/close/client";

/**
 * Close.io-Call-Sync fürs interne Marketing-Center: zieht Transkripte aus
 * Cold Calls, Quali-Calls etc. - Rohmaterial, um Einwände/Glaubenssätze aus
 * echten Verkaufsgesprächen in Content zu verarbeiten (siehe content-
 * ideas.ts). Schreibt in dieselbe CallTranscript-Tabelle wie Fireflies
 * (source: CLOSE) - gleiche Architektur wie fireflies.ts, siehe dort für die
 * ausführlichere Begründung der Zwei-Phasen-Logik.
 *
 * closeCallsSyncEnabled defaultet in der DB auf false (CLAUDE.md-Automations-
 * regel) - für diese Einführung wurde die Live-Schaltung vor dem Bau bewusst
 * mit dem Nutzer abgestimmt (siehe PlatformSettings-Modell-Kommentar).
 *
 * Volle Gesprächstranskripte gibt es nur mit Close's "Call Assistant"-Add-on
 * (ab 30s Gesprächsdauer) - ohne dieses Add-on liefert der Sync nur
 * Voicemail-Transkripte (die Close immer kostenlos transkribiert), kein
 * Fehler, nur weniger Material.
 */

const INITIAL_BACKFILL_DAYS = 90;
const MAX_DETAIL_FETCHES_PER_RUN = 25;

/** An/Aus-Schalter im Konfiguration-Reiter des internen Marketing-Centers - nur AGENCY_ADMIN. */
export async function toggleCloseCallsSync(): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const settings = await getPlatformSettings();
  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { closeCallsSyncEnabled: !settings.closeCallsSyncEnabled },
  });
  revalidatePath("/dashboard/intern/marketing/social");
}

/**
 * Eigentliche Sync-Logik, unabhängig vom Automatik-Schalter - siehe
 * runFirefliesSync für die gleiche Begründung der Struktur.
 *
 * Ablauf: 1) Kandidaten (Calls mit tatsächlichem Gesprächsinhalt oder
 * Voicemail) seit dem letzten gespeicherten Call abholen und als Metadaten
 * sofort speichern. 2) Für die neuesten noch unvollständigen Einträge den
 * vollen Transkripttext nachladen.
 */
async function runCloseCallsSync(): Promise<{ synced: number; failed: number; skipped?: string }> {
  const latest = await prisma.callTranscript.findFirst({
    where: { source: "CLOSE" },
    orderBy: { dateTime: "desc" },
    select: { dateTime: true },
  });
  const fromDate = latest?.dateTime ?? new Date(Date.now() - INITIAL_BACKFILL_DAYS * 24 * 60 * 60 * 1000);

  let synced = 0;
  let failed = 0;

  try {
    const candidatesResult = await listCloseCallCandidates(fromDate);
    if (!candidatesResult.ok) throw new Error(candidatesResult.error);

    const existingIds = new Set(
      (
        await prisma.callTranscript.findMany({
          where: { source: "CLOSE", externalId: { in: candidatesResult.rows.map((c) => c.externalId) } },
          select: { externalId: true },
        })
      ).map((r) => r.externalId),
    );

    for (const candidate of candidatesResult.rows) {
      if (existingIds.has(candidate.externalId)) continue;
      try {
        await prisma.callTranscript.create({
          data: {
            source: "CLOSE",
            externalId: candidate.externalId,
            title: candidate.title,
            dateTime: candidate.dateTime,
            durationMinutes: candidate.durationMinutes,
            organizerEmail: candidate.organizerEmail,
            participants: candidate.participants,
          },
        });
      } catch (error) {
        failed++;
        console.error("[close-calls] Metadaten-Speicherung fehlgeschlagen", candidate.externalId, error);
      }
    }

    const pendingDetail = await prisma.callTranscript.findMany({
      where: { source: "CLOSE", transcriptText: null },
      orderBy: { dateTime: "desc" },
      take: MAX_DETAIL_FETCHES_PER_RUN,
      select: { id: true, externalId: true, participants: true },
    });

    for (const row of pendingDetail) {
      try {
        const [leadName, userName] = row.participants;
        const result = await getCloseCallTranscript(row.externalId, leadName ?? "Unbekannter Kontakt", userName ?? null);
        if (!result.ok) throw new Error(result.error);
        await prisma.callTranscript.update({
          where: { id: row.id },
          data: { transcriptText: result.transcriptText ?? "", summaryOverview: result.summaryOverview },
        });
        synced++;
      } catch (error) {
        failed++;
        console.error("[close-calls] Transkript-Fetch fehlgeschlagen", row.externalId, error);
      }
    }

    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { closeCallsLastSyncedAt: new Date(), closeCallsLastSyncError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Close-Call-Sync.";
    await prisma.platformSettings.update({ where: { id: "singleton" }, data: { closeCallsLastSyncError: message } });
    return { synced, failed, skipped: message };
  }

  revalidatePath("/dashboard/intern/marketing/social");
  return { synced, failed };
}

/** Vom Cron aufgerufen (api/cron/close-calls-sync). No-op, wenn kein API-Key gesetzt oder der Automatik-Schalter aus ist. */
export async function syncCloseCallTranscripts(): Promise<{ synced: number; failed: number; skipped?: string }> {
  if (!process.env.CLOSE_API_KEY) return { synced: 0, failed: 0, skipped: "CLOSE_API_KEY ist nicht konfiguriert." };

  const settings = await getPlatformSettings();
  if (!settings.closeCallsSyncEnabled) return { synced: 0, failed: 0, skipped: "Close-Call-Sync ist deaktiviert." };

  return runCloseCallsSync();
}

/** "Jetzt synchronisieren"-Button in der Konfiguration - läuft unabhängig vom Automatik-Schalter, nur AGENCY_ADMIN. */
export async function triggerCloseCallsSyncNow(): Promise<{ synced: number; failed: number; skipped?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { synced: 0, failed: 0, skipped: "Keine Berechtigung." };

  if (!process.env.CLOSE_API_KEY) return { synced: 0, failed: 0, skipped: "CLOSE_API_KEY ist nicht konfiguriert." };

  return runCloseCallsSync();
}
