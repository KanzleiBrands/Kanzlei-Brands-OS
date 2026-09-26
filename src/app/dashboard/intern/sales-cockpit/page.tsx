import { redirect } from "next/navigation";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { listWonOpportunitiesByMonth, listOutboundCallsByMonth } from "@/lib/close/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Sales Cockpit - vereinfachte Nachbildung der geteilten Google-Sheet-
 * Vorlage ("Sales Tracking Cockpit 2026"): Anrufe/Abschlüsse/Volumen kommen
 * live aus Close.io, kein manuelles "End of Day" mehr nötig. Für den
 * gesamten Vertrieb sichtbar (reines Betrachter-Tool, keine Bearbeitung
 * hier) - Geschäftsführung/Admin sehen es ebenfalls. Rep-Zuordnung erfolgt
 * über Close.ios eigenen user_name, da keine Verknüpfung zwischen internem
 * User und Close-User-ID gepflegt wird.
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

  const [callsResult, dealsResult] = await Promise.all([
    listOutboundCallsByMonth(year),
    listWonOpportunitiesByMonth(year),
  ]);

  const callsByMonth = new Array(13).fill(0) as number[];
  const dealsByMonth = new Array(13).fill(0) as number[];
  const volumeByMonth = new Array(13).fill(0) as number[];
  if (callsResult.ok) for (const row of callsResult.rows) callsByMonth[row.month] += row.callCount;
  if (dealsResult.ok) {
    for (const row of dealsResult.rows) {
      dealsByMonth[row.month] += 1;
      volumeByMonth[row.month] += row.valueNet;
    }
  }
  const closeRateByMonth = callsByMonth.map((calls, i) => (calls > 0 ? (dealsByMonth[i] / calls) * 100 : 0));

  type RepStats = { userName: string; calls: number; deals: number; volume: number };
  const repStats = new Map<string, RepStats>();
  if (callsResult.ok) {
    for (const row of callsResult.rows) {
      const stats = repStats.get(row.userId) ?? { userName: row.userName, calls: 0, deals: 0, volume: 0 };
      stats.calls += row.callCount;
      repStats.set(row.userId, stats);
    }
  }
  if (dealsResult.ok) {
    for (const row of dealsResult.rows) {
      const stats = repStats.get(row.userId) ?? { userName: row.userName, deals: 0, calls: 0, volume: 0 };
      stats.deals += 1;
      stats.volume += row.valueNet;
      repStats.set(row.userId, stats);
    }
  }

  const totalCalls = callsByMonth.reduce((a, b) => a + b, 0);
  const totalDeals = dealsByMonth.reduce((a, b) => a + b, 0);
  const totalVolume = volumeByMonth.reduce((a, b) => a + b, 0);
  const notConnected = !callsResult.ok || !dealsResult.ok;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sales Cockpit</h1>
          <p className="text-muted-foreground">Live aus Close.io · {year} · nur Betrachtung</p>
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
          Hinweis: Close.io ist nicht verbunden ({!callsResult.ok ? callsResult.error : (dealsResult as { ok: false; error: string }).error}).
          Zahlen zeigen 0, bis CLOSE_API_KEY in den Umgebungsvariablen gesetzt ist.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Anrufe ({year})</CardTitle></CardHeader>
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
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Close-Rate ({year})</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{totalCalls > 0 ? `${((totalDeals / totalCalls) * 100).toFixed(1)}%` : "–"}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Team-Verlauf pro Monat</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Kennzahl</th>
                {MONTHS.map((m) => (
                  <th key={m} className="p-2 text-right font-medium text-muted-foreground">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 text-muted-foreground">Anrufe</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className="p-2 text-right tabular-nums">{callsByMonth[i + 1]}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-2 text-muted-foreground">Abschlüsse</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className="p-2 text-right tabular-nums">{dealsByMonth[i + 1]}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-2 text-muted-foreground">Volumen</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className="p-2 text-right tabular-nums">{eur.format(volumeByMonth[i + 1])}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2 font-medium">Close-Rate</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className="p-2 text-right font-medium tabular-nums">{closeRateByMonth[i + 1].toFixed(0)}%</td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pro Vertriebler ({year})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Vertriebler</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Anrufe</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Abschlüsse</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Volumen</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Close-Rate</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(repStats.values())
                .sort((a, b) => b.volume - a.volume)
                .map((stats) => (
                  <tr key={stats.userName} className="border-b last:border-0">
                    <td className="p-2">{stats.userName}</td>
                    <td className="p-2 text-right tabular-nums">{stats.calls}</td>
                    <td className="p-2 text-right tabular-nums">{stats.deals}</td>
                    <td className="p-2 text-right tabular-nums">{eur.format(stats.volume)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {stats.calls > 0 ? `${((stats.deals / stats.calls) * 100).toFixed(1)}%` : "–"}
                    </td>
                  </tr>
                ))}
              {repStats.size === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">Keine Daten vorhanden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
