"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";

function revalidateCashflow() {
  revalidatePath("/dashboard/intern/cashflow");
}

/**
 * Cashflow Cockpit ist ausschließlich für die Geschäftsführung (department
 * EXECUTIVE) bzw. AGENCY_ADMIN - andere Abteilungen (auch Vertrieb) sehen
 * hier keine Zahlen.
 */
async function requireExecutiveAccess(organizationId: string) {
  const session = await requireSession();
  assertOrganizationAccess(session, organizationId);
  if (session.user.role === "AGENCY_ADMIN") return session;

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
  if (user?.department !== "EXECUTIVE") {
    throw new AccessDeniedError("Das Cashflow Cockpit ist nur für die Geschäftsführung sichtbar.");
  }
  return session;
}

export async function setCashflowCost(formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireExecutiveAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const category = String(formData.get("category") ?? "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amountNet = Number(formData.get("amountNet"));
  if (!["PERSONNEL", "MARKETING", "INFRASTRUCTURE", "VARIABLE", "AD_BUDGET"].includes(category)) return "Ungültige Kategorie.";
  if (!year || month < 1 || month > 12 || Number.isNaN(amountNet)) return "Ungültige Eingabe.";

  await prisma.cashflowCostEntry.upsert({
    where: { organizationId_category_year_month: { organizationId, category: category as never, year, month } },
    create: { organizationId, category: category as never, year, month, amountNet },
    update: { amountNet },
  });
  revalidateCashflow();
  return undefined;
}

export async function setProfitGoal(formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireExecutiveAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const raw = String(formData.get("profitGoalAnnual") ?? "").trim();
  const profitGoalAnnual = raw ? Math.round(Number(raw)) : null;
  if (raw && Number.isNaN(profitGoalAnnual)) return "Ungültiges Jahresziel.";

  await prisma.organization.update({ where: { id: organizationId }, data: { profitGoalAnnual } });
  revalidateCashflow();
  return undefined;
}
