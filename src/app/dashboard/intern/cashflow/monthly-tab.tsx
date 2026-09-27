import { prisma } from "@/lib/prisma";
import { getCashInForYear } from "@/lib/cashflow/cash-in-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, MONTHS } from "@/lib/cashflow/constants";
import { TransactionRow } from "./transaction-row";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurDetailed = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function MonthlyTab({ organizationId, year, month }: { organizationId: string; year: number; month: number }) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const [cashInResult, costEntries] = await Promise.all([
    getCashInForYear(organizationId, year),
    prisma.cashflowCostEntry.findMany({
      where: { organizationId, transactionDate: { gte: monthStart, lt: monthEnd } },
      orderBy: { transactionDate: "desc" },
    }),
  ]);

  // "Cash-In" ist tatsächlicher Cashflow, nicht Rechnungsvolumen - nur
  // bezahlte Rechnungen zählen (Geplant/Überfällig ist noch kein Geldeingang).
  const cashInThisMonth = cashInResult.rows
    .filter((r) => r.status === "BEZAHLT" && new Date(r.invoiceDate).getMonth() + 1 === month)
    .reduce((sum, r) => sum + r.amountNet, 0);
  const cashOutThisMonth = costEntries.reduce((sum, e) => sum + e.amountNet, 0);
  const operatingCashflow = cashInThisMonth - cashOutThisMonth;

  const byCategory = new Map<string, number>();
  for (const entry of costEntries) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amountNet);

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
          {cashInResult.usedFallback && " Cash-In zeigt hier den importierten Verlauf, nicht Live-Daten."}
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

      <div>
        <p className="mb-2 text-sm font-medium">Cash-Out nach Bereich - {MONTHS[month - 1]} {year}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Card key={key}>
              <CardHeader><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold">{eurDetailed.format(byCategory.get(key) ?? 0)}</p></CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Buchungen {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Datum</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Gegenpartei</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Kategorie</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Netto</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Steuersatz</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Bank</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Notiz</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {costEntries.map((entry) => (
                <TransactionRow
                  key={entry.id}
                  id={entry.id}
                  date={dateFmt.format(entry.transactionDate)}
                  counterparty={entry.counterparty}
                  categoryLabel={CATEGORY_LABELS[entry.category] ?? entry.category}
                  amountNet={eurDetailed.format(entry.amountNet)}
                  taxRatePercent={entry.taxRatePercent}
                  bankSource={entry.bankSource}
                  note={entry.note}
                />
              ))}
              {costEntries.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Keine Buchungen für {MONTHS[month - 1]} {year}.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
