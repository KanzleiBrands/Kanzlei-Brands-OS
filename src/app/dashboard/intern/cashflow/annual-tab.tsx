import { prisma } from "@/lib/prisma";
import { listCashInForYear } from "@/lib/easybill/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfitGoalForm } from "./profit-goal-form";
import { TaxReserveForm } from "./tax-reserve-form";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export async function AnnualTab({ organizationId, year }: { organizationId: string; year: number }) {
  const [organization, cashInResult, costEntries] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { profitGoalAnnual: true, cashflowTaxReservePercent: true } }),
    listCashInForYear(year),
    prisma.cashflowCostEntry.findMany({
      where: { organizationId, transactionDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    }),
  ]);

  const cashIn = cashInResult.ok ? cashInResult.rows.reduce((sum, r) => sum + r.amountNet, 0) : 0;
  const cashOut = costEntries.reduce((sum, e) => sum + e.amountNet, 0);
  const operatingCashflow = cashIn - cashOut;
  const taxReservePercent = organization?.cashflowTaxReservePercent ?? null;
  const cashflowBit = taxReservePercent != null ? operatingCashflow * (1 - taxReservePercent / 100) : null;
  const profitGoalAnnual = organization?.profitGoalAnnual ?? null;
  const profitGoalPct = profitGoalAnnual ? Math.round((operatingCashflow / profitGoalAnnual) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {[year - 1, year, year + 1].map((y) => (
          <a
            key={y}
            href={`/dashboard/intern/cashflow?tab=jahr&year=${y}`}
            className={`rounded-md px-3 py-1.5 text-sm ${y === year ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
          >
            {y}
          </a>
        ))}
      </div>

      {!cashInResult.ok && (
        <p className="rounded-md border border-dashed border-foreground/15 p-3 text-sm text-muted-foreground">
          Hinweis: EasyBill ist nicht verbunden ({cashInResult.error}). Cash-In zeigt 0, bis EASYBILL_API_KEY gesetzt ist.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Cash-In, netto ({year})</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(cashIn)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Cash-Out, netto ({year})</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(cashOut)}</p></CardContent>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Profitgoal-Fortschritt</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-2xl font-semibold">{profitGoalPct != null ? `${profitGoalPct}%` : "–"}</p>
            <ProfitGoalForm organizationId={organizationId} profitGoalAnnual={profitGoalAnnual} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Cashflow BIT (nach Steuerrücklage)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className={`text-2xl font-semibold ${cashflowBit != null && cashflowBit < 0 ? "text-red-600" : ""}`}>
              {cashflowBit != null ? eur.format(cashflowBit) : "–"}
            </p>
            <TaxReserveForm organizationId={organizationId} cashflowTaxReservePercent={taxReservePercent} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
