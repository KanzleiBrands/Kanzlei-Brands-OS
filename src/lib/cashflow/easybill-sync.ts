import { prisma } from "@/lib/prisma";
import { listCashInForYear, listCashInForecast, type CashInEntry } from "@/lib/easybill/client";

export type EasybillSyncResult = { ok: boolean; invoicesWritten: number; forecastWritten: number; error?: string };

function upsertCacheRow(organizationId: string, row: CashInEntry) {
  const invoiceDate = new Date(row.invoiceDate);
  const dueDate = row.dueDate ? new Date(row.dueDate) : null;
  const paidAt = row.paidAt ? new Date(row.paidAt) : null;
  return prisma.easybillCashInCache.upsert({
    where: {
      organizationId_easybillDocumentId_isForecast_invoiceDate: {
        organizationId,
        easybillDocumentId: row.easybillDocumentId,
        isForecast: row.isForecast,
        invoiceDate,
      },
    },
    create: {
      organizationId,
      easybillDocumentId: row.easybillDocumentId,
      isForecast: row.isForecast,
      customerId: row.customerId,
      customerLabel: row.customerLabel,
      product: row.product,
      invoiceDate,
      dueDate,
      paidAt,
      isDraft: row.isDraft,
      amountNet: row.amountNet,
      amountGross: row.amountGross,
      taxRatePercent: row.taxRatePercent,
      number: row.number,
    },
    update: {
      customerId: row.customerId,
      customerLabel: row.customerLabel,
      product: row.product,
      dueDate,
      paidAt,
      isDraft: row.isDraft,
      amountNet: row.amountNet,
      amountGross: row.amountGross,
      taxRatePercent: row.taxRatePercent,
      number: row.number,
      syncedAt: new Date(),
    },
  });
}

/**
 * Zieht EasyBill-Cash-In-Daten in einem festen Intervall (siehe
 * /api/cron/easybill-sync) in EasybillCashInCache - ersetzt das frühere
 * Live-Abfragen bei jedem Tab-/Monatswechsel im Cashflow Cockpit, das
 * EasyBills strenges Rate-Limit ausgelöst hat (429). Tatsächliche Rechnungen
 * (isForecast=false) werden stabil per easybillDocumentId upgesertet, der
 * Forecast (isForecast=true) wird bei jedem Lauf komplett ersetzt, da er
 * ohnehin bei jedem Sync neu aus den laufenden Rechnungsvorlagen berechnet
 * wird (kein "Fortschreiben" möglich).
 */
export async function syncEasybillCashIn(organizationId: string): Promise<EasybillSyncResult> {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear, thisYear + 1];

  const yearResults = await Promise.all(years.map((year) => listCashInForYear(year)));
  const failedYear = yearResults.find((r) => !r.ok);
  if (failedYear && !failedYear.ok) {
    return { ok: false, invoicesWritten: 0, forecastWritten: 0, error: failedYear.error };
  }

  let invoicesWritten = 0;
  for (const result of yearResults) {
    if (!result.ok) continue;
    for (const row of result.rows) {
      await upsertCacheRow(organizationId, row);
      invoicesWritten += 1;
    }
  }

  const forecastResult = await listCashInForecast(6);
  let forecastWritten = 0;
  if (forecastResult.ok) {
    await prisma.easybillCashInCache.deleteMany({ where: { organizationId, isForecast: true } });
    for (const row of forecastResult.rows) {
      await upsertCacheRow(organizationId, row);
      forecastWritten += 1;
    }
  }

  return {
    ok: true,
    invoicesWritten,
    forecastWritten,
    error: forecastResult.ok ? undefined : forecastResult.error,
  };
}
