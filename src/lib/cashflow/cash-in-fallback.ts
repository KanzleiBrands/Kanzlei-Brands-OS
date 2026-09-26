import { prisma } from "@/lib/prisma";
import { listCashInForYear, type CashInEntry } from "@/lib/easybill/client";

export type CashInYearResult = {
  ok: boolean;
  rows: CashInEntry[];
  error?: string;
  usedFallback: boolean;
};

/**
 * Cash-In für ein Jahr - live aus EasyBill, mit Fallback auf die historisch
 * importierten Rechnungen (CashInLedgerEntry, aus den alten Cashflow-Cockpit-
 * Sheets 2025/2026 übernommen), solange EasyBill nicht verbunden ist oder für
 * das Jahr keine Rechnungen liefert. Sobald EasyBill live Daten liefert, hat
 * das Vorrang - der Import ist nur eine Übergangslösung.
 */
export async function getCashInForYear(organizationId: string, year: number): Promise<CashInYearResult> {
  const live = await listCashInForYear(year);
  if (live.ok && live.rows.length > 0) return { ok: true, rows: live.rows, usedFallback: false };

  const ledgerEntries = await prisma.cashInLedgerEntry.findMany({
    where: { organizationId, invoiceDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
  });
  if (ledgerEntries.length === 0) {
    return live.ok ? { ok: true, rows: [], usedFallback: false } : { ok: false, error: live.error, rows: [], usedFallback: false };
  }

  const rows: CashInEntry[] = ledgerEntries.map((e, i) => ({
    easybillDocumentId: -(i + 1),
    customerId: null,
    customerLabel: e.customerName,
    product: e.product,
    invoiceDate: e.invoiceDate.toISOString(),
    dueDate: null,
    amountNet: e.amountNet,
    amountGross: e.amountNet * (1 + e.taxRatePercent / 100),
    taxRatePercent: e.taxRatePercent,
    status: e.status,
    number: null,
    isForecast: false,
  }));

  return { ok: live.ok, error: live.ok ? undefined : live.error, rows, usedFallback: true };
}
