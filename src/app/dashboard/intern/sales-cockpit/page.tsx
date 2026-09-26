import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { listOpenerStats, listSetterStats, listCloserStats, listClosedDeals } from "@/lib/close/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function pct(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(0)}%` : "–";
}

type DealAttribution = Map<string, { deals: number; volume: number }>;

function attributeDeals(deals: { openerUserId: string | null; setterUserId: string | null; closerUserId: string | null; amountNet: number }[], role: "openerUserId" | "setterUserId" | "closerUserId"): DealAttribution {
  const byUser: DealAttribution = new Map();
  for (const deal of deals) {
    const userId = deal[role];
    if (!userId) continue;
    const entry = byUser.get(userId) ?? { deals: 0, volume: 0 };
    entry.deals += 1;
    entry.volume += deal.amountNet;
    byUser.set(userId, entry);
  }
  return byUser;
}

/**
 * Sales Cockpit - Opener/Setter/Closer komplett live aus Close Custom
 * Activities (siehe src/lib/close/client.ts), kein manuelles End-of-Day
 * mehr. Bewusst OHNE Close-Opportunities/generische Call-Aktivitäten -
 * genau die drei Rollen-Formulare, die im Vertrieb tatsächlich gepflegt
 * werden. Für den gesamten Vertrieb sichtbar (reines Betrachter-Tool).
 */
export default async function SalesCockpitPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_STAFF") redirect("/dashboard");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
  if (session.user.role !== "AGENCY_ADMIN" && user?.department !== "SALES" && user?.department !== "EXECUTIVE") {
    redirect("/dashboard/intern");
  }

  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || new Date().getFullYear();

  const [openerResult, setterResult, closerResult, dealsResult] = await Promise.all([
    listOpenerStats(year),
    listSetterStats(year),
    listCloserStats(year),
    listClosedDeals(year),
  ]);

  const notConnected = !openerResult.ok || !setterResult.ok || !closerResult.ok || !dealsResult.ok;
  const firstError = !openerResult.ok
    ? openerResult.error
    : !setterResult.ok
      ? setterResult.error
      : !closerResult.ok
        ? closerResult.error
        : !dealsResult.ok
          ? dealsResult.error
          : null;

  const deals = dealsResult.ok ? dealsResult.rows : [];
  const byOpener = attributeDeals(deals, "openerUserId");
  const bySetter = attributeDeals(deals, "setterUserId");
  const byCloser = attributeDeals(deals, "closerUserId");

  const openerRows = openerResult.ok ? openerResult.rows : [];
  const setterRows = setterResult.ok ? setterResult.rows : [];
  const closerRows = closerResult.ok ? closerResult.rows : [];

  const totalDeals = deals.length;
  const totalVolume = deals.reduce((sum, d) => sum + d.amountNet, 0);
  const totalCalls = openerRows.reduce((sum, r) => sum + r.calls, 0);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sales Cockpit</h1>
          <p className="text-muted-foreground">Opener / Setter / Closer · live aus Close.io · {year}</p>
        </div>
        <div className="flex gap-1">
          {[year - 1, year, year + 1].map((y) => (
            <a
              key={y}
              href={`/dashboard/intern/sales-cockpit?year=${y}`}
              className={`rounded-md px-3 py-1.5 text-sm ${y === year ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      {notConnected && (
        <p className="rounded-md border border-dashed border-foreground/15 p-3 text-sm text-muted-foreground">
          Hinweis: Close.io ist nicht verbunden ({firstError}). Zahlen zeigen 0, bis CLOSE_API_KEY in den
          Umgebungsvariablen gesetzt ist.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Anwahlen ({year})</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{totalCalls}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Abschlüsse ({year})</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{totalDeals}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Deal-Volumen ({year})</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{eur.format(totalVolume)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Opener</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Opener</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Anwahlen</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Erreicht</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Erreichquote</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Entscheider</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Entscheiderquote</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Termine gesetzt</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Terminquote</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Abschlüsse</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Volumen</th>
              </tr>
            </thead>
            <tbody>
              {openerRows
                .sort((a, b) => b.calls - a.calls)
                .map((r) => {
                  const attribution = byOpener.get(r.userId);
                  return (
                    <tr key={r.userId} className="border-b last:border-0">
                      <td className="p-2">{r.userName}</td>
                      <td className="p-2 text-right tabular-nums">{r.calls}</td>
                      <td className="p-2 text-right tabular-nums">{r.reached}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.reached, r.calls)}</td>
                      <td className="p-2 text-right tabular-nums">{r.decisionMakerReached}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.decisionMakerReached, r.calls)}</td>
                      <td className="p-2 text-right tabular-nums">{r.appointmentsSet}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.appointmentsSet, r.calls)}</td>
                      <td className="p-2 text-right tabular-nums">{attribution?.deals ?? 0}</td>
                      <td className="p-2 text-right tabular-nums">{eur.format(attribution?.volume ?? 0)}</td>
                    </tr>
                  );
                })}
              {openerRows.length === 0 && (
                <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Keine Daten vorhanden.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Setter</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Setter</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Erstgespräche</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Stattgefunden</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Show-Rate</th>
                <th className="p-2 text-right font-medium text-muted-foreground">No-Show-Rate</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Qualifiziert</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Qualifiziert-Quote</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Beratung angeboten</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Abschlüsse</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Volumen</th>
              </tr>
            </thead>
            <tbody>
              {setterRows
                .sort((a, b) => b.qualiCalls - a.qualiCalls)
                .map((r) => {
                  const attribution = bySetter.get(r.userId);
                  return (
                    <tr key={r.userId} className="border-b last:border-0">
                      <td className="p-2">{r.userName}</td>
                      <td className="p-2 text-right tabular-nums">{r.qualiCalls}</td>
                      <td className="p-2 text-right tabular-nums">{r.shown}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.shown, r.qualiCalls)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.qualiCalls - r.shown, r.qualiCalls)}</td>
                      <td className="p-2 text-right tabular-nums">{r.qualified}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.qualified, r.shown)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.consultationOffered, r.shown)}</td>
                      <td className="p-2 text-right tabular-nums">{attribution?.deals ?? 0}</td>
                      <td className="p-2 text-right tabular-nums">{eur.format(attribution?.volume ?? 0)}</td>
                    </tr>
                  );
                })}
              {setterRows.length === 0 && (
                <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Keine Daten vorhanden.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Closer</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Closer</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Sales Calls</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Stattgefunden</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Show-Rate</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Angebot gemacht</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Angebotsquote</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Abschlüsse</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Close-Rate</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Volumen</th>
              </tr>
            </thead>
            <tbody>
              {closerRows
                .sort((a, b) => b.salesCalls - a.salesCalls)
                .map((r) => {
                  const attribution = byCloser.get(r.userId);
                  return (
                    <tr key={r.userId} className="border-b last:border-0">
                      <td className="p-2">{r.userName}</td>
                      <td className="p-2 text-right tabular-nums">{r.salesCalls}</td>
                      <td className="p-2 text-right tabular-nums">{r.shown}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.shown, r.salesCalls)}</td>
                      <td className="p-2 text-right tabular-nums">{r.offersMade}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.offersMade, r.shown)}</td>
                      <td className="p-2 text-right tabular-nums">{attribution?.deals ?? 0}</td>
                      <td className="p-2 text-right tabular-nums">{pct(attribution?.deals ?? 0, r.offersMade)}</td>
                      <td className="p-2 text-right tabular-nums">{eur.format(attribution?.volume ?? 0)}</td>
                    </tr>
                  );
                })}
              {closerRows.length === 0 && (
                <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Keine Daten vorhanden.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
