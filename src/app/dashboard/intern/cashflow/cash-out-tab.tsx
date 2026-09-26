import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddTransactionForm } from "./add-transaction-form";
import { BankCsvImport } from "./bank-csv-import";
import { TransactionRow } from "./transaction-row";

const CATEGORY_LABELS: Record<string, string> = {
  PERSONNEL: "Mitarbeiter & Freelancer",
  MARKETING: "Marketing",
  INFRASTRUCTURE: "Infrastruktur & Software",
  VARIABLE: "Variable Kosten",
  AD_BUDGET: "Werbebudget",
};

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Cash-Out als Transaktions-Ledger (eine Zeile = eine Buchung vom
 * Bankkonto), genau wie im Original-Sheet. Aktuell manuelle Eingabe -
 * CSV-Import mit Spalten-Zuordnung folgt, sobald ein Beispiel-Export
 * vorliegt (siehe Chat).
 */
export async function CashOutTab({ organizationId, year }: { organizationId: string; year: number }) {
  const entries = await prisma.cashflowCostEntry.findMany({
    where: { organizationId, transactionDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    orderBy: { transactionDate: "desc" },
  });

  const total = entries.reduce((sum, e) => sum + e.amountNet, 0);
  const byCategory = new Map<string, number>();
  for (const entry of entries) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amountNet);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {[year - 1, year, year + 1].map((y) => (
          <a
            key={y}
            href={`/dashboard/intern/cashflow?tab=cashout&year=${y}`}
            className={`rounded-md px-3 py-1.5 text-sm ${y === year ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
          >
            {y}
          </a>
        ))}
      </div>

      <AddTransactionForm organizationId={organizationId} />
      <BankCsvImport organizationId={organizationId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Cash-Out gesamt</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{eur.format(total)}</p></CardContent>
        </Card>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Card key={key}>
            <CardHeader><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-lg font-semibold">{eur.format(byCategory.get(key) ?? 0)}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
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
              {entries.map((entry) => (
                <TransactionRow
                  key={entry.id}
                  id={entry.id}
                  date={dateFmt.format(entry.transactionDate)}
                  counterparty={entry.counterparty}
                  categoryLabel={CATEGORY_LABELS[entry.category] ?? entry.category}
                  amountNet={eur.format(entry.amountNet)}
                  taxRatePercent={entry.taxRatePercent}
                  bankSource={entry.bankSource}
                  note={entry.note}
                />
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Noch keine Buchungen für {year}.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
