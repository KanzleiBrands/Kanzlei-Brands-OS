"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { getValidGscAccessToken, listGscSites, type GscSite } from "@/lib/google-search-console/client";

const SEO_TAB_PATH = "/dashboard/intern/marketing/seo";

function requireAgencyAdmin(role: string): void {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

/** Properties, auf die der verbundene Google-Account Zugriff hat - für die Auswahl nach dem Connect (siteUrl noch null). */
export async function getGscSiteOptions(): Promise<{ ok: true; sites: GscSite[] } | { ok: false; error: string }> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
    const accessToken = await getValidGscAccessToken();
    const sites = await listGscSites(accessToken);
    return { ok: true, sites };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler." };
  }
}

/** Legt fest, welche Search-Console-Property für die Content-Lücken-Analyse verwendet wird. */
export async function selectGscSite(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  const siteUrl = String(formData.get("siteUrl") ?? "").trim();
  if (!siteUrl) return;

  await prisma.googleSearchConsoleConnection.update({ where: { id: "singleton" }, data: { siteUrl } });
  revalidatePath(SEO_TAB_PATH);
}

/** Trennt die Google-Search-Console-Verbindung - der Cron zur Lücken-Analyse läuft danach einfach nicht mehr (kein Fehler). */
export async function disconnectGsc(): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return;

  await prisma.googleSearchConsoleConnection.deleteMany({ where: { id: "singleton" } });
  revalidatePath(SEO_TAB_PATH);
}
