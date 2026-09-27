"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { AdPlatform } from "@prisma/client";
import { getSession } from "@/lib/impersonation";
import { AccessDeniedError } from "@/lib/access";
import { syncCloseAttribution, type CloseSyncResult } from "@/lib/attribution/close-sync";

const AD_PLATFORMS: AdPlatform[] = ["META", "GOOGLE", "LINKEDIN", "ORGANIC", "DIRECT", "OTHER"];

async function requireAgencyAdmin() {
  const session = await getSession();
  if (!session?.user) throw new AccessDeniedError("Nicht eingeloggt.");
  if (session.user.role !== "AGENCY_ADMIN") {
    throw new AccessDeniedError("Diese Funktion ist nur für die Geschäftsführung verfügbar.");
  }
  return session;
}

export async function runCloseAttributionSync(): Promise<CloseSyncResult> {
  const session = await requireAgencyAdmin();
  const result = await syncCloseAttribution(session.user.organizationId);
  revalidatePath("/dashboard/intern/marketing/campaigns");
  return result;
}

export async function addManualAdSpend(formData: FormData): Promise<void> {
  const session = await requireAgencyAdmin();
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const platformRaw = String(formData.get("platform") ?? "");
  const platform = AD_PLATFORMS.find((p) => p === platformRaw);
  const date = String(formData.get("date") ?? "");
  const amountSpent = Number(formData.get("amountSpent") ?? 0);
  if (!campaignId) throw new Error("Bitte eine Kampagne auswählen.");
  if (!platform) throw new Error("Ungültige Plattform.");
  if (!date || !amountSpent) throw new Error("Datum und Betrag sind Pflichtfelder.");

  await prisma.adSpendEntry.upsert({
    where: {
      organizationId_campaignId_platform_date: {
        organizationId: session.user.organizationId,
        campaignId,
        platform,
        date: new Date(date),
      },
    },
    create: { organizationId: session.user.organizationId, campaignId, platform, date: new Date(date), amountSpent, source: "MANUAL" },
    update: { amountSpent, source: "MANUAL" },
  });

  revalidatePath("/dashboard/intern/marketing/campaigns");
}
