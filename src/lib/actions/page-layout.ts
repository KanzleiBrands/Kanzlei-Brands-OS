"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { PAGE_BLOCK_CATALOG } from "@/lib/page-layout";
import type { DashboardPage } from "@prisma/client";

function requireAgencyAdmin(role: string) {
  if (role !== "AGENCY_ADMIN") throw new Error("Nur Agentur-Admins können das Seiten-Layout bearbeiten.");
}

const PAGE_PATHS: Record<DashboardPage, string> = {
  OVERVIEW: "/dashboard",
  HUB: "/dashboard/hub",
};

export async function savePageLayout(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  requireAgencyAdmin(session.user.role);

  const page = String(formData.get("page") ?? "");
  if (page !== "OVERVIEW" && page !== "HUB") return "Ungültige Seite.";

  let blocks: { key: string; enabled: boolean }[];
  try {
    blocks = JSON.parse(String(formData.get("blocks") ?? "[]"));
  } catch {
    return "Ungültige Daten.";
  }

  const validKeys = new Set(PAGE_BLOCK_CATALOG[page].map((b) => b.key));
  const filtered = blocks.filter((b) => validKeys.has(b.key));
  if (filtered.length !== validKeys.size) return "Unvollständige Daten - bitte Seite neu laden.";

  await prisma.$transaction(
    filtered.map((block, index) =>
      prisma.pageLayoutBlock.upsert({
        where: { page_blockKey: { page, blockKey: block.key } },
        create: { page, blockKey: block.key, order: index, enabled: block.enabled },
        update: { order: index, enabled: block.enabled },
      }),
    ),
  );

  await logAudit({
    action: "page_layout.updated",
    entityType: "PageLayoutBlock",
    entityId: page,
    organizationId: session.user.organizationId,
    userId: session.user.id,
  });

  revalidatePath(PAGE_PATHS[page]);
  revalidatePath("/dashboard/settings");
  return undefined;
}
