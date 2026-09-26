import { prisma } from "@/lib/prisma";
import { listCashInForYear } from "@/lib/easybill/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export async function MonthlyTab({ organizationId, year, month }: { organizationId: string; year: number; month: number }) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const [cashInResult, costEntries] = await Promise.all([
    listCashInForYear(year),
    prisma.cashflowCostEntry.findMany({ where: { organizationId, transactionDate: { gte: monthStart, lt: monthEnd } } }),
  ]);

  const cashInThisMonth = cashInResult.ok
    ? cashInResult.rows.filter((r) => new Date(r.invoiceDate).getMonth() + 1 === month).reduce((sum, r) => sum + r.amountNet, 0)
    : 0;
  const cashOutThisMonth = costEntries.reduce((sum, e) => sum + e.amountNet, 0);
  const operatingCashflow = cashInThisMonth - cashOutThisMonth;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {MONTHS.map((label, i) => (
          <a
            key={label}
            href={`/dashboard/intern/cashflow?tab=monat&year=${year}&month=${i + 1}`}
            className={`rounded-md px-3 py-1.5 text-sm ${month === i + 1 ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
          >
            {label}
          </a>
        ))}
        <span className="ml-2 self-center text-sm text-muted-foreground">{year}</span>
      </div>

      {!cashInResult.ok && (
        <p className="rounded-md border border-dashed border-foreground/15 p-3 text-sm text-muted-foreground">
          Hinweis: EasyBill ist nicht verbunden ({cashInResult.error}).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Cash-In, netto</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(cashInThisMonth)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Cash-Out, netto</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(cashOutThisMonth)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Operating Cashflow</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${operatingCashflow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {eur.format(operatingCashflow)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
