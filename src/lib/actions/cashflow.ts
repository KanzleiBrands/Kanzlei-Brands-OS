"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertOrganizationAccess, AccessDeniedError } from "@/lib/access";

function revalidateCashflow() {
  revalidatePath("/dashboard/intern/cashflow");
}

/**
 * Cashflow Cockpit ist ausschließlich für die Geschäftsführung (department
 * EXECUTIVE) bzw. AGENCY_ADMIN sichtbar - zusätzlich kann die GF gezielt
 * einzelnen Mitarbeiter:innen (z.B. Backoffice) über User.hasCashflowAccess
 * Zugriff freischalten, ohne deren Abteilung zu ändern.
 */
async function requireExecutiveAccess(organizationId: string) {
  const session = await requireSession();
  assertOrganizationAccess(session, organizationId);
  if (session.user.role === "AGENCY_ADMIN") return session;

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true, hasCashflowAccess: true } });
  if (user?.department !== "EXECUTIVE" && !user?.hasCashflowAccess) {
    throw new AccessDeniedError("Das Cashflow Cockpit ist nur für die Geschäftsführung sichtbar.");
  }
  return session;
}

const TAX_RATES = [0, 7, 19];
const COST_CATEGORIES = ["PERSONNEL", "MARKETING", "INFRASTRUCTURE", "VARIABLE", "AD_BUDGET"];

export async function addCashflowTransaction(formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireExecutiveAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const transactionDate = new Date(String(formData.get("transactionDate") ?? ""));
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const amountNet = Number(formData.get("amountNet"));
  const taxRatePercent = Number(formData.get("taxRatePercent"));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (Number.isNaN(transactionDate.getTime())) return "Ungültiges Datum.";
  if (!counterparty) return "Bitte eine Gegenpartei angeben.";
  if (!COST_CATEGORIES.includes(category)) return "Ungültige Kategorie.";
  if (Number.isNaN(amountNet) || amountNet <= 0) return "Ungültiger Betrag.";
  if (!TAX_RATES.includes(taxRatePercent)) return "Ungültiger Steuersatz.";

  const bankSource = String(formData.get("bankSource") ?? "").trim() || null;

  await prisma.cashflowCostEntry.create({
    data: { organizationId, transactionDate, counterparty, category: category as never, amountNet, taxRatePercent, note, bankSource },
  });
  revalidateCashflow();
  return undefined;
}

type ImportRow = {
  transactionDate: string; // ISO-Datum
  counterparty: string;
  amountNet: number;
  category: string;
  taxRatePercent: number;
  bankSource: string;
};

/** Bulk-Import von Bank-CSV-Buchungen (Cash-Out) - Zeilen sind bereits im Browser geparst/geprüft. */
export async function importCashOutTransactions(formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireExecutiveAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return "Ungültige Import-Daten.";
  }
  if (!Array.isArray(rows) || rows.length === 0) return "Keine Buchungen zum Importieren.";

  const data = rows
    .filter((r) => COST_CATEGORIES.includes(r.category) && TAX_RATES.includes(r.taxRatePercent) && r.amountNet > 0)
    .map((r) => ({
      organizationId,
      transactionDate: new Date(r.transactionDate),
      counterparty: r.counterparty,
      category: r.category as never,
      amountNet: r.amountNet,
      taxRatePercent: r.taxRatePercent,
      bankSource: r.bankSource || null,
    }));
  if (data.length === 0) return "Keine gültigen Buchungen zum Importieren.";

  await prisma.cashflowCostEntry.createMany({ data });
  revalidateCashflow();
  return undefined;
}

export async function deleteCashflowTransaction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const entry = await prisma.cashflowCostEntry.findUnique({ where: { id } });
  if (!entry) return;
  try {
    await requireExecutiveAccess(entry.organizationId);
  } catch {
    return;
  }
  await prisma.cashflowCostEntry.delete({ where: { id } });
  revalidateCashflow();
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

export async function setTaxReservePercent(formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requireExecutiveAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const raw = String(formData.get("cashflowTaxReservePercent") ?? "").trim();
  const cashflowTaxReservePercent = raw ? Number(raw) : null;
  if (cashflowTaxReservePercent != null && (Number.isNaN(cashflowTaxReservePercent) || cashflowTaxReservePercent < 0 || cashflowTaxReservePercent > 100)) {
    return "Ungültiger Prozentsatz (0-100).";
  }

  await prisma.organization.update({ where: { id: organizationId }, data: { cashflowTaxReservePercent } });
  revalidateCashflow();
  return undefined;
}

/** Ordnet eine EasyBill-Kunden-ID einer bestehenden Organisation (Kunde im Portal) zu. */
export async function mapEasybillCustomer(formData: FormData): Promise<string | undefined> {
  const organizationId = String(formData.get("organizationId") ?? ""); // Agentur-Org (Zugriffsprüfung)
  try {
    await requireExecutiveAccess(organizationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return error.message;
    throw error;
  }

  const clientOrganizationId = String(formData.get("clientOrganizationId") ?? "");
  const easybillCustomerId = Number(formData.get("easybillCustomerId"));
  if (!clientOrganizationId || Number.isNaN(easybillCustomerId)) return "Ungültige Zuordnung.";

  const existing = await prisma.organization.findUnique({ where: { easybillCustomerId } });
  if (existing && existing.id !== clientOrganizationId) return "Dieser EasyBill-Kunde ist bereits einem anderen Kunden zugeordnet.";

  await prisma.organization.update({ where: { id: clientOrganizationId }, data: { easybillCustomerId } });
  revalidateCashflow();
  return undefined;
}

export async function unmapEasybillCustomer(formData: FormData): Promise<void> {
  const clientOrganizationId = String(formData.get("clientOrganizationId") ?? "");
  const org = await prisma.organization.findUnique({ where: { id: clientOrganizationId }, select: { parentId: true, id: true } });
  if (!org) return;
  try {
    // Zugriffsprüfung über die Agentur-Organisation des aktuellen Nutzers.
    const session = await requireSession();
    await requireExecutiveAccess(session.user.organizationId);
  } catch {
    return;
  }
  await prisma.organization.update({ where: { id: clientOrganizationId }, data: { easybillCustomerId: null } });
  revalidateCashflow();
}

/** Schaltet Cashflow-Cockpit-Zugriff für einen einzelnen Mitarbeiter frei/ab (z.B. Backoffice) - nur AGENCY_ADMIN. */
export async function setCashflowAccess(formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") return "Nur Agentur-Admins können Cashflow-Zugriff vergeben.";

  const userId = String(formData.get("userId") ?? "");
  const hasCashflowAccess = formData.get("hasCashflowAccess") === "true";
  await prisma.user.update({ where: { id: userId }, data: { hasCashflowAccess } });
  revalidateCashflow();
  return undefined;
}
