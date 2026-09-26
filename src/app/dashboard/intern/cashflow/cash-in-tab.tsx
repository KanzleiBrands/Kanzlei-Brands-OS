import { listCashInForYear, listCashInForecast, type CashInEntry, type CashInStatus } from "@/lib/easybill/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerMappingRow } from "./customer-mapping-row";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS_LABEL: Record<CashInStatus, string> = { GEPLANT: "Geplant", BEZAHLT: "Bezahlt", UEBERFAELLIG: "Überfällig" };
const STATUS_CLASS: Record<CashInStatus, string> = {
  GEPLANT: "bg-muted text-muted-foreground",
  BEZAHLT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  UEBERFAELLIG: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

function InvoiceTable({ rows, emptyLabel }: { rows: CashInEntry[]; emptyLabel: string }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b">
          <th className="p-2 text-left font-medium text-muted-foreground">Datum</th>
          <th className="p-2 text-left font-medium text-muted-foreground">Kunde</th>
          <th className="p-2 text-left font-medium text-muted-foreground">Produkt</th>
          <th className="p-2 text-right font-medium text-muted-foreground">Netto</th>
          <th className="p-2 text-right font-medium text-muted-foreground">Brutto</th>
          <th className="p-2 text-right font-medium text-muted-foreground">Steuersatz</th>
          <th className="p-2 text-left font-medium text-muted-foreground">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.easybillDocumentId}-${row.invoiceDate}`} className="border-b last:border-0">
            <td className="p-2 whitespace-nowrap">{dateFmt.format(new Date(row.invoiceDate))}</td>
            <td className="p-2">{row.customerLabel}</td>
            <td className="p-2">{row.product}</td>
            <td className="p-2 text-right tabular-nums">{eur.format(row.amountNet)}</td>
            <td className="p-2 text-right tabular-nums">{eur.format(row.amountGross)}</td>
            <td className="p-2 text-right tabular-nums">{row.taxRatePercent}%</td>
            <td className="p-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}>
                {STATUS_LABEL[row.status]}
              </span>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{emptyLabel}</td></tr>
        )}
      </tbody>
    </table>
  );
}

export async function CashInTab({ organizationId, year }: { organizationId: string; year: number }) {
  const [invoicesResult, forecastResult, clients] = await Promise.all([
    listCashInForYear(year),
    listCashInForecast(6),
    prisma.organization.findMany({
      where: { type: "CLIENT", parentId: organizationId },
      select: { id: true, name: true, easybillCustomerId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const invoices = invoicesResult.ok
    ? [...invoicesResult.rows].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
    : [];
  const forecast = forecastResult.ok ? [...forecastResult.rows].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)) : [];
  const notConnected = !invoicesResult.ok || !forecastResult.ok;

  const mappedByEasybillId = new Map(clients.filter((c) => c.easybillCustomerId != null).map((c) => [c.easybillCustomerId as number, c]));
  const unmappedClients = clients.filter((c) => c.easybillCustomerId == null).map((c) => ({ id: c.id, name: c.name }));
  const distinctEasybillCustomers = new Map<number, string>();
  for (const invoice of [...invoices, ...forecast]) {
    if (invoice.customerId != null) distinctEasybillCustomers.set(invoice.customerId, invoice.customerLabel);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {[year - 1, year, year + 1].map((y) => (
          <a
            key={y}
            href={`/dashboard/intern/cashflow?tab=cashin&year=${y}`}
            className={`rounded-md px-3 py-1.5 text-sm ${y === year ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
          >
            {y}
          </a>
        ))}
      </div>

      {notConnected && (
        <p className="rounded-md border border-dashed border-foreground/15 p-3 text-sm text-muted-foreground">
          Hinweis: EasyBill ist nicht verbunden ({!invoicesResult.ok ? invoicesResult.error : (forecastResult as { ok: false; error: string }).error}).
          Ohne EASYBILL_API_KEY werden keine Rechnungen angezeigt.
        </p>
      )}

      {distinctEasybillCustomers.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kunden-Zuordnung</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ordnet EasyBill-Kunden den Kunden aus dem Portal zu - nicht jeder EasyBill-Kunde muss zugeordnet sein.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Array.from(distinctEasybillCustomers.entries()).map(([easybillCustomerId, label]) => (
              <CustomerMappingRow
                key={easybillCustomerId}
                organizationId={organizationId}
                easybillCustomerId={easybillCustomerId}
                easybillLabel={label}
                mappedOrganization={mappedByEasybillId.get(easybillCustomerId) ?? null}
                unmappedClients={unmappedClients}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Rechnungen {year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <InvoiceTable rows={invoices} emptyLabel="Keine Rechnungen für dieses Jahr gefunden." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forecast - nächste 6 Monate</CardTitle>
          <p className="text-sm text-muted-foreground">Aus laufenden wiederkehrenden Rechnungsvorlagen in EasyBill.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <InvoiceTable rows={forecast} emptyLabel="Keine laufenden wiederkehrenden Rechnungen gefunden." />
        </CardContent>
      </Card>
    </div>
  );
}
