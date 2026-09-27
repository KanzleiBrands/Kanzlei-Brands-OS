import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CandidateAccountSummary } from "@/lib/attribution/stats";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function AccountList({ accounts }: { accounts: CandidateAccountSummary[] }) {
  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Candidate Journeys erfasst.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-2 text-left font-medium text-muted-foreground">Kanzlei</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Ansprechpartner</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Letzte Aktivität</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="p-2 text-right font-medium text-muted-foreground">Deal-Wert</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-2">
                <Link href={`/dashboard/intern/marketing/campaigns/${account.id}`} className="font-medium hover:underline">
                  {account.name ?? account.domain ?? "Unbekannt"}
                </Link>
              </td>
              <td className="p-2 text-right tabular-nums">{account.candidateCount}</td>
              <td className="p-2">{account.lastEventAt ? dateFmt.format(account.lastEventAt) : "–"}</td>
              <td className="p-2">
                {account.dealWon ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Gewonnen</Badge> : <Badge variant="secondary">Läuft</Badge>}
              </td>
              <td className="p-2 text-right tabular-nums">{account.dealValue != null ? eur.format(account.dealValue) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
