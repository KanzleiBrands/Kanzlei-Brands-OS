import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { listWonOpportunitiesByMonth } from "@/lib/close/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CostCell } from "./cost-cell";
import { ProfitGoalForm } from "./profit-goal-form";

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

const COST_CATEGORIES = [
  { key: "PERSONNEL", label: "Mitarbeiter & Freelancer" },
  { key: "MARKETING", label: "Marketing" },
  { key: "INFRASTRUCTURE", label: "Infrastruktur & Software" },
  { key: "VARIABLE", label: "Variable Kosten" },
  { key: "AD_BUDGET", label: "Werbebudget" },
] as const;

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Cashflow Cockpit - vereinfachte Nachbildung der geteilten Google-Sheet-
 * Vorlage ("Cashflow Cockpit 2026"): Cash-In kommt live aus Close.io
 * (gewonnene Opportunities), Cash-Out wird manuell je Kategorie/Monat
 * gepflegt (editierbare Zellen wie bei Abwesenheitskontingenten). Bewusst
 * ohne Brutto/USt-Aufschlüsselung und ohne wiederkehrende Zahlungsläufe aus
 * der Vorlage - reine Netto-Zahlen, um das Konzept schlank abzubilden. Nur
 * für die Geschäftsführung sichtbar (siehe requireExecutiveAccess).
 */
export default async function CashflowCockpitPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
  if (session.user.role !== "AGENCY_ADMIN" && user?.department !== "EXECUTIVE") redirect("/dashboard/intern");

  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || new Date().getFullYear();
  const organizationId = session.user.organizationId;

  const [organization, costEntries, closeResult] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { profitGoalAnnual: true } }),
    prisma.cashflowCostEntry.findMany({ where: { organizationId, year } }),
    listWonOpportunitiesByMonth(year),
  ]);

  const costByKey = new Map<string, number>();
  for (const entry of costEntries) costByKey.set(`${entry.category}:${entry.month}`, entry.amountNet);

  const cashInByMonth = new Array(13).fill(0) as number[];
  if (closeResult.ok) {
    for (const row of closeResult.rows) cashInByMonth[row.month] += row.valueNet;
  }

  const cashOutByMonth = new Array(13).fill(0) as number[];
  for (const category of COST_CATEGORIES) {
    for (let month = 1; month <= 12; month++) {
      cashOutByMonth[month] += costByKey.get(`${category.key}:${month}`) ?? 0;
    }
  }

  const operatingByMonth = cashInByMonth.map((cashIn, month) => cashIn - cashOutByMonth[month]);
  const cumulativeOperating = operatingByMonth.reduce((sum, value) => sum + value, 0);
  const profitGoalAnnual = organization?.profitGoalAnnual ?? null;
  const profitGoalPct = profitGoalAnnual ? Math.round((cumulativeOperating / profitGoalAnnual) * 100) : null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cashflow Cockpit</h1>
          <p className="text-muted-foreground">Nur für die Geschäftsführung · {year}</p>
        </div>
        <div className="flex gap-1">
          {[year - 1, year, year + 1].map((y) => (
            <a
              key={y}
              href={`/dashboard/intern/cashflow?year=${y}`}
              className={`rounded-md px-3 py-1.5 text-sm ${y === year ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      {!closeResult.ok && (
        <p className="rounded-md border border-dashed border-foreground/15 p-3 text-sm text-muted-foreground">
          Hinweis: Close.io ist nicht verbunden ({closeResult.error}). Cash-In zeigt 0, bis CLOSE_API_KEY in den
          Umgebungsvariablen gesetzt ist.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Operating Cashflow ({year})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${cumulativeOperating >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {eur.format(cumulativeOperating)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Cash-In gesamt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{eur.format(cashInByMonth.reduce((a, b) => a + b, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Profitgoal-Fortschritt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-2xl font-semibold">{profitGoalPct != null ? `${profitGoalPct}%` : "–"}</p>
            <ProfitGoalForm organizationId={organizationId} profitGoalAnnual={profitGoalAnnual} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Kategorie</th>
                {MONTHS.map((m) => (
                  <th key={m} className="p-2 text-right font-medium text-muted-foreground">{m}</th>
                ))}
                <th className="p-2 text-right font-medium text-muted-foreground">Summe</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                <td className="p-2 font-medium">Cash-In (Close.io, live)</td>
                {MONTHS.map((_, i) => {
                  const month = i + 1;
                  return (
                    <td key={month} className="p-2 text-right tabular-nums">
                      {eur.format(cashInByMonth[month])}
                    </td>
                  );
                })}
                <td className="p-2 text-right font-medium tabular-nums">
                  {eur.format(cashInByMonth.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {COST_CATEGORIES.map((category) => {
                const rowTotal = Array.from({ length: 12 }, (_, i) => costByKey.get(`${category.key}:${i + 1}`) ?? 0).reduce(
                  (a, b) => a + b,
                  0,
                );
                return (
                  <tr key={category.key} className="border-b">
                    <td className="p-2 text-muted-foreground">{category.label}</td>
                    {MONTHS.map((_, i) => {
                      const month = i + 1;
                      return (
                        <td key={month} className="p-1.5 text-right">
                          <CostCell
                            organizationId={organizationId}
                            category={category.key}
                            year={year}
                            month={month}
                            amountNet={costByKey.get(`${category.key}:${month}`) ?? 0}
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-right text-muted-foreground tabular-nums">{eur.format(rowTotal)}</td>
                  </tr>
                );
              })}

              <tr className="border-b bg-muted/40">
                <td className="p-2 font-medium">Cash-Out gesamt</td>
                {MONTHS.map((_, i) => {
                  const month = i + 1;
                  return (
                    <td key={month} className="p-2 text-right font-medium tabular-nums">
                      {eur.format(cashOutByMonth[month])}
                    </td>
                  );
                })}
                <td className="p-2 text-right font-medium tabular-nums">
                  {eur.format(cashOutByMonth.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              <tr>
                <td className="p-2 font-semibold">Operating Cashflow</td>
                {MONTHS.map((_, i) => {
                  const month = i + 1;
                  const value = operatingByMonth[month];
                  return (
                    <td key={month} className={`p-2 text-right font-semibold tabular-nums ${value >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {eur.format(value)}
                    </td>
                  );
                })}
                <td className={`p-2 text-right font-semibold tabular-nums ${cumulativeOperating >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {eur.format(cumulativeOperating)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
