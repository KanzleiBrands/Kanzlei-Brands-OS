import type { EasybillCashInCache } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentStatus, type CashInEntry, type EasybillResult } from "@/lib/easybill/client";

export type CashInYearResult = {
  ok: boolean;
  rows: CashInEntry[];
  error?: string;
  usedFallback: boolean;
};

function toCashInEntry(row: EasybillCashInCache): CashInEntry {
  const dueDate = row.dueDate ? row.dueDate.toISOString() : null;
  const paidAt = row.paidAt ? row.paidAt.toISOString() : null;
  return {
    easybillDocumentId: row.easybillDocumentId,
    customerId: row.customerId,
    customerLabel: row.customerLabel,
    product: row.product,
    invoiceDate: row.invoiceDate.toISOString(),
    dueDate,
    isDraft: row.isDraft,
    paidAt,
    amountNet: row.amountNet,
    amountGross: row.amountGross,
    taxRatePercent: row.taxRatePercent,
    status: documentStatus({ isDraft: row.isDraft, paidAt, dueDate }, new Date()),
    number: row.number,
    isForecast: row.isForecast,
  };
}

/**
 * Cash-In für ein Jahr - liest aus EasybillCashInCache (siehe
 * /api/cron/easybill-sync, der die Daten in einem festen Intervall aus
 * EasyBill nachzieht statt bei jedem Tab-/Monatswechsel live abzufragen -
 * das hatte EasyBills Rate-Limit ausgelöst). Der Status wird bei jedem Lesen
 * frisch aus dem zwischengespeicherten isDraft/paidAt/dueDate berechnet
 * (z.B. GEPLANT -> ÜBERFÄLLIG), damit er zwischen zwei Syncs nicht veraltet.
 * Fallback auf die historisch importierten Rechnungen (CashInLedgerEntry,
 * aus den alten Cashflow-Cockpit-Sheets 2025/2026 übernommen), solange für
 * das Jahr noch nichts synchronisiert wurde.
 */
export async function getCashInForYear(organizationId: string, year: number): Promise<CashInYearResult> {
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year + 1}-01-01`);

  const cached = await prisma.easybillCashInCache.findMany({
    where: { organizationId, isForecast: false, invoiceDate: { gte: yearStart, lt: yearEnd } },
    orderBy: { invoiceDate: "asc" },
  });
  if (cached.length > 0) return { ok: true, rows: cached.map(toCashInEntry), usedFallback: false };

  const ledgerEntries = await prisma.cashInLedgerEntry.findMany({
    where: { organizationId, invoiceDate: { gte: yearStart, lt: yearEnd } },
  });
  if (ledgerEntries.length > 0) {
    const rows: CashInEntry[] = ledgerEntries.map((e, i) => ({
      easybillDocumentId: -(i + 1),
      customerId: null,
      customerLabel: e.customerName,
      product: e.product,
      invoiceDate: e.invoiceDate.toISOString(),
      dueDate: null,
      isDraft: false,
      paidAt: e.status === "BEZAHLT" ? e.invoiceDate.toISOString() : null,
      amountNet: e.amountNet,
      amountGross: e.amountNet * (1 + e.taxRatePercent / 100),
      taxRatePercent: e.taxRatePercent,
      status: e.status,
      number: null,
      isForecast: false,
    }));
    return { ok: true, rows, usedFallback: true };
  }

  if (!process.env.EASYBILL_API_KEY) {
    return { ok: false, error: "EASYBILL_API_KEY ist nicht konfiguriert.", rows: [], usedFallback: false };
  }
  const everSynced = await prisma.easybillCashInCache.findFirst({ where: { organizationId }, select: { id: true } });
  if (!everSynced) {
    return {
      ok: false,
      error: "Noch keine Synchronisierung gelaufen - Rechnungen erscheinen nach dem nächsten automatischen EasyBill-Abgleich.",
      rows: [],
      usedFallback: false,
    };
  }
  return { ok: true, rows: [], usedFallback: false };
}

/** Forecast aus EasybillCashInCache (isForecast=true) - siehe getCashInForYear für die Sync-Architektur. */
export async function getCashInForecast(organizationId: string, monthsAhead: number): Promise<EasybillResult<CashInEntry>> {
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + monthsAhead);

  const cached = await prisma.easybillCashInCache.findMany({
    where: { organizationId, isForecast: true, invoiceDate: { lte: horizon } },
    orderBy: { invoiceDate: "asc" },
  });
  if (cached.length > 0) return { ok: true, rows: cached.map(toCashInEntry) };

  if (!process.env.EASYBILL_API_KEY) return { ok: false, error: "EASYBILL_API_KEY ist nicht konfiguriert." };
  const everSynced = await prisma.easybillCashInCache.findFirst({ where: { organizationId, isForecast: true }, select: { id: true } });
  if (!everSynced) {
    return { ok: false, error: "Noch keine Synchronisierung gelaufen - Forecast erscheint nach dem nächsten automatischen EasyBill-Abgleich." };
  }
  return { ok: true, rows: [] };
}
