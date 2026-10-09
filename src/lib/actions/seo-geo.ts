"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getPlatformSettings } from "@/lib/actions/platform-settings";
import { isDataForSeoConfigured, checkGeoVisibility, type GeoProvider } from "@/lib/dataforseo/client";

/**
 * GEO-Sichtbarkeit: prüft, ob die Marke bei typischen Mandanten-Fragen von
 * ChatGPT/Claude/Gemini/Perplexity genannt bzw. als Quelle zitiert wird -
 * das eigentliche Ziel "GEO-Agentur statt nur SEO-Agentur" (siehe Diskussion
 * in der Session). Bewusst manuell getriggert wie die übrige DataForSEO-
 * Anreicherung (seo-dataforseo.ts) - jeder Check fragt 4 echte KI-Modelle ab
 * und kostet entsprechend mehr.
 */

const SEO_TAB_PATH = "/dashboard/intern/marketing/seo";
const PROVIDERS: GeoProvider[] = ["CHATGPT", "CLAUDE", "GEMINI", "PERPLEXITY"];
// Harte Obergrenze pro Lauf (x4 Modelle) - schützt vor versehentlichen Kosten,
// falls jemand sehr viele Prompts hinterlegt. Bei Bedarf einfach erneut klicken.
const MAX_PROMPTS_PER_RUN = 25;

function requireAgencyAdmin(role: string): void {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

export async function addGeoMonitoredPrompt(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return;
  const label = String(formData.get("label") ?? "").trim() || null;

  await prisma.geoMonitoredPrompt.create({ data: { prompt, label } });
  revalidatePath(SEO_TAB_PATH);
}

export async function removeGeoMonitoredPrompt(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const id = String(formData.get("id") ?? "");
  await prisma.geoMonitoredPrompt.delete({ where: { id } }).catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}

/** Markenname, nach dem in den KI-Antworten gesucht wird (z.B. "Kanzlei Brands"). */
export async function updateGeoTargetBrandName(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const brandName = String(formData.get("brandName") ?? "").trim();
  await getPlatformSettings();
  await prisma.platformSettings.update({ where: { id: "singleton" }, data: { geoTargetBrandName: brandName || null } });
  revalidatePath(SEO_TAB_PATH);
}

/** "Jetzt prüfen"-Button: fragt jeden hinterlegten Prompt bei allen 4 KI-Modellen ab - teuerster DataForSEO-Aufruf hier, daher die harte Obergrenze. */
export async function triggerGeoVisibilityCheckNow(): Promise<{ checked: number; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return { checked: 0, error: "Keine Berechtigung." };
  if (!isDataForSeoConfigured()) return { checked: 0, error: "DataForSEO ist nicht konfiguriert (siehe .env.example)." };

  const settings = await getPlatformSettings();
  if (!settings.geoTargetBrandName) return { checked: 0, error: "Bitte zuerst den Markennamen in der Konfiguration setzen." };

  const prompts = await prisma.geoMonitoredPrompt.findMany({ orderBy: { addedAt: "desc" }, take: MAX_PROMPTS_PER_RUN });
  if (prompts.length === 0) return { checked: 0, error: "Noch keine Prompts hinterlegt." };

  let checked = 0;
  const errors: string[] = [];
  for (const prompt of prompts) {
    for (const provider of PROVIDERS) {
      const result = await checkGeoVisibility(provider, prompt.prompt, {
        brandName: settings.geoTargetBrandName,
        targetDomain: settings.dataForSeoTargetDomain,
      });
      if (!result.ok) {
        errors.push(`${prompt.label ?? prompt.prompt.slice(0, 40)} (${provider}): ${result.error}`);
        continue;
      }
      await prisma.geoVisibilityCheck.upsert({
        where: { promptId_provider: { promptId: prompt.id, provider } },
        update: { ...result.data, checkedAt: new Date() },
        create: { promptId: prompt.id, provider, ...result.data },
      });
      checked++;
    }
  }

  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { dataForSeoLastSyncedAt: new Date(), dataForSeoLastSyncError: errors[0] ?? null },
  });
  revalidatePath(SEO_TAB_PATH);
  return { checked, error: errors.length > 0 ? `${errors.length} Fehler, z.B.: ${errors[0]}` : undefined };
}
