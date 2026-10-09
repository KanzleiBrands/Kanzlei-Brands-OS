"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";

/**
 * Rein manuelles Backlink-Tracking (siehe SeoBacklink-Modell-Kommentar:
 * weder Google Search Console noch byclaire.co selbst automatisieren echten
 * Linkaufbau - das bleibt überall manuelle/menschliche PR-Arbeit). Diese
 * Liste hilft nur, den Überblick über geplante/angefragte/erreichte
 * Platzierungen zu behalten.
 */

function requireAgencyAdmin(role: string): void {
  if (role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
}

const SEO_TAB_PATH = "/dashboard/intern/marketing/seo";

export async function createSeoBacklink(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const domain = String(formData.get("domain") ?? "").trim();
  if (!domain) return;
  const url = String(formData.get("url") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.seoBacklink.create({ data: { domain, url, note } });
  revalidatePath(SEO_TAB_PATH);
}

export async function updateSeoBacklinkStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["GEPLANT", "ANGEFRAGT", "LIVE", "ABGELEHNT"].includes(status)) return;

  await prisma.seoBacklink
    .update({ where: { id }, data: { status: status as "GEPLANT" | "ANGEFRAGT" | "LIVE" | "ABGELEHNT" } })
    .catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}

export async function deleteSeoBacklink(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    requireAgencyAdmin(session.user.role);
  } catch {
    return;
  }

  const id = String(formData.get("id") ?? "");
  await prisma.seoBacklink.delete({ where: { id } }).catch(() => {});
  revalidatePath(SEO_TAB_PATH);
}
