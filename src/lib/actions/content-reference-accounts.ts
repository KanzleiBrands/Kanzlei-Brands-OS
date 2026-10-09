"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertCanManageSocialContentFor } from "@/lib/access";
import { decryptToken } from "@/lib/auth-encryption";
import { fetchInstagramBusinessDiscovery, MetaGraphError } from "@/lib/meta/graph";
import { getAnthropicClient } from "@/lib/anthropic";

/**
 * Referenz-/Vorbild-Accounts pro Kunde (Konfiguration-Reiter des Content
 * Boards) - nicht zwingend aus der gleichen Branche, einfach Accounts, an
 * deren Stil/Format/Aufbau man sich orientieren will. Nur INSTAGRAM lässt
 * sich automatisch scannen (Metas "Business Discovery", siehe
 * src/lib/meta/graph.ts) - dafür muss der Kunde selbst einen verbundenen
 * Instagram-Kanal haben. scanEnabled defaultet in der DB auf false; der
 * Scan selbst passiert nur, wenn ihn die Agentur bewusst pro Account anstößt
 * oder aktiviert (siehe CLAUDE.md-Automationsregel).
 */

function isValidPlatform(value: string): value is "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "OTHER" {
  return value === "INSTAGRAM" || value === "FACEBOOK" || value === "LINKEDIN" || value === "OTHER";
}

export async function addReferenceAccount(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return "Kunde ist erforderlich.";
  try {
    await assertCanManageSocialContentFor(session, organizationId);
  } catch {
    return "Nur Agentur-Admins oder Marketing-Mitarbeiter können Referenz-Accounts anlegen.";
  }

  const platformRaw = String(formData.get("platform") ?? "").trim();
  const platform = isValidPlatform(platformRaw) ? platformRaw : null;
  if (!platform) return "Plattform ist erforderlich.";

  const handle = String(formData.get("handle") ?? "").trim();
  if (!handle) return platform === "INSTAGRAM" ? "Instagram-Nutzername ist erforderlich." : "Profil-Link ist erforderlich.";

  const displayName = String(formData.get("displayName") ?? "").trim();

  await prisma.contentReferenceAccount.create({
    data: { organizationId, platform, handle, displayName: displayName || null },
  });

  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
  return undefined;
}

export async function deleteReferenceAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const account = await prisma.contentReferenceAccount.findUnique({ where: { id } });
  if (!account) return;
  try {
    await assertCanManageSocialContentFor(session, account.organizationId);
  } catch {
    return;
  }

  await prisma.contentReferenceAccount.delete({ where: { id } });
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${account.organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
}

/** An/Aus für den automatischen Hintergrund-Scan dieses einen Accounts - nur für INSTAGRAM wirksam. */
export async function toggleReferenceAccountScan(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const account = await prisma.contentReferenceAccount.findUnique({ where: { id } });
  if (!account || account.platform !== "INSTAGRAM") return;
  try {
    await assertCanManageSocialContentFor(session, account.organizationId);
  } catch {
    return;
  }

  await prisma.contentReferenceAccount.update({ where: { id }, data: { scanEnabled: !account.scanEnabled } });
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${account.organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
}

const TOP_POSTS_FOR_ANALYSIS = 12;

/**
 * Holt die letzten Posts eines Instagram-Referenz-Accounts per Business
 * Discovery (über den eigenen verbundenen IG-Kanal des Kunden) und lässt
 * Claude daraus eine Muster-Zusammenfassung (Formate/Hooks/Themen/Aufbau)
 * schreiben - diese Zusammenfassung fließt später in die Ideen-Generierung
 * ein (siehe content-ideas.ts). Wird sowohl vom "Jetzt scannen"-Button als
 * auch vom Cron aufgerufen - wirft nie, sondern speichert Fehler in
 * lastSyncError, damit ein einzelner kaputter Account nie den ganzen
 * Cron-Lauf abbricht.
 */
export async function syncReferenceAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  const account = await prisma.contentReferenceAccount.findUnique({ where: { id: accountId } });
  if (!account) return { success: false, error: "Referenz-Account nicht gefunden." };
  if (account.platform !== "INSTAGRAM") {
    return { success: false, error: "Automatischer Scan ist nur für Instagram-Accounts möglich." };
  }

  const igChannel = await prisma.socialChannel.findFirst({
    where: { organizationId: account.organizationId, platform: "INSTAGRAM", active: true },
  });
  if (!igChannel) {
    const error = "Kein verbundener Instagram-Kanal für diesen Kunden - Business Discovery braucht einen eigenen IG-Business-Account.";
    await prisma.contentReferenceAccount.update({ where: { id: accountId }, data: { lastSyncError: error } });
    return { success: false, error };
  }

  try {
    const discovery = await fetchInstagramBusinessDiscovery(
      igChannel.externalId,
      decryptToken(igChannel.accessTokenEnc),
      account.handle,
    );

    const topPosts = discovery.media
      .slice()
      .sort((a, b) => (b.likeCount ?? 0) + (b.commentsCount ?? 0) - ((a.likeCount ?? 0) + (a.commentsCount ?? 0)))
      .slice(0, TOP_POSTS_FOR_ANALYSIS);

    if (topPosts.length === 0) {
      const error = `"${account.handle}" hat keine öffentlich sichtbaren Posts geliefert.`;
      await prisma.contentReferenceAccount.update({
        where: { id: accountId },
        data: { lastSyncError: error, lastSyncedAt: new Date() },
      });
      return { success: false, error };
    }

    const postsBlock = topPosts
      .map((p, i) => {
        const engagement = `${p.likeCount ?? 0} Likes, ${p.commentsCount ?? 0} Kommentare`;
        return `${i + 1}. [${p.mediaType}, ${engagement}]\n${(p.caption ?? "(kein Text)").slice(0, 600)}`;
      })
      .join("\n\n");

    const prompt = `Du analysierst die erfolgreichsten Instagram-Posts eines Vorbild-/Inspirations-Accounts ("@${discovery.username}", ${discovery.followersCount ?? "?"} Follower), um daraus wiederverwendbare Muster für die Social-Media-Content-Erstellung eines anderen Kunden abzuleiten. Es geht NICHT um das Thema/die Branche dieses Accounts, sondern um übertragbare Muster: Format-Mix (Reel/Bild/Karussell), Hook-Stil, Aufbau/Struktur, Tonalität, was die erfolgreichsten Posts gemeinsam haben.

Die nach Engagement (Likes+Kommentare) sortierten Top-Posts (Format, Engagement, Text/Caption):
"""
${postsBlock}
"""

Schreibe eine kompakte Analyse (max. 200 Wörter, deutsch, Fließtext oder kurze Stichpunkte) mit: (1) welche Formate dominieren, (2) wie die Hooks/ersten Zeilen typischerweise aufgebaut sind, (3) welche inhaltlichen/strukturellen Muster bei den erfolgreichsten Posts auffallen. Keine Bewertung des Themas/der Branche, nur übertragbare Stil-/Format-Muster. Antworte ausschließlich auf Deutsch, ohne Einleitung oder Erklärung davor.`;

    let lastAnalysis: string;
    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      lastAnalysis = textBlock?.text.trim() || "Keine Analyse erzeugt.";
    } catch (error) {
      lastAnalysis = `(KI-Analyse fehlgeschlagen: ${error instanceof Error ? error.message : "unbekannter Fehler"} - Rohdaten wurden trotzdem aktualisiert.)`;
    }

    await prisma.contentReferenceAccount.update({
      where: { id: accountId },
      data: {
        displayName: account.displayName || discovery.username,
        lastAnalysis,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof MetaGraphError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Scannen.";
    await prisma.contentReferenceAccount.update({
      where: { id: accountId },
      data: { lastSyncError: message, lastSyncedAt: new Date() },
    });
    return { success: false, error: message };
  }
}

/** AGENCY_ADMIN-triggered "Jetzt scannen" auf einem einzelnen Referenz-Account - Server-Action-Wrapper um syncReferenceAccount. */
export async function syncReferenceAccountNow(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const account = await prisma.contentReferenceAccount.findUnique({ where: { id } });
  if (!account) return;
  try {
    await assertCanManageSocialContentFor(session, account.organizationId);
  } catch {
    return;
  }

  await syncReferenceAccount(id);
  revalidatePath("/dashboard/social");
  revalidatePath(`/dashboard/clients/${account.organizationId}`);
  revalidatePath("/dashboard/intern/marketing/social");
}

/** Vom Cron aufgerufen - scannt alle Accounts, bei denen der automatische Hintergrund-Scan bewusst aktiviert wurde. */
export async function syncAllDueReferenceAccounts(): Promise<{ scanned: number; failed: number }> {
  const due = await prisma.contentReferenceAccount.findMany({ where: { scanEnabled: true, platform: "INSTAGRAM" } });
  let scanned = 0;
  let failed = 0;
  for (const account of due) {
    const result = await syncReferenceAccount(account.id);
    if (result.success) scanned++;
    else failed++;
  }
  return { scanned, failed };
}
